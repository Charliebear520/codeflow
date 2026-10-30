// 僅寫入 codeflow_demo 的本次專用測試 collections；不在正式伺服器加入登入繞過機制。
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Student from "../models/Student.js";
import Submission from "../models/Submission.js";
import { getMongoUri } from "../lib/db.js";
import { seedDemo, buildDemoData } from "../lib/demoData.js";
import { createSubmissionStore } from "../lib/submissionStore.js";
import { registerSubmissionRoutes } from "../lib/submissionRoutes.js";
import { createRequireTeacher } from "../lib/teacherAccess.js";
import { registerActivityRoutes } from "../lib/activityRoutes.js";
import { createTeacherReporting } from "../lib/teacherReporting.js";

test("real MongoDB: seed, student write/retry/restore, scoring and teacher read with owner isolation", { timeout: 60000 }, async (t) => {
  assert.equal(process.env.MONGO_DB_NAME, "codeflow_demo", "測試只允許 codeflow_demo");
  const run = randomUUID().replaceAll("-", "");
  const connection = await mongoose.createConnection(getMongoUri(), {
    dbName: "codeflow_demo", autoIndex: false, serverSelectionTimeoutMS: 10000,
  }).asPromise();
  const Students = connection.model("Student", Student.schema, `test_${run}_students`);
  const Submissions = connection.model("Submission", Submission.schema, `test_${run}_submissions`);
  const store = createSubmissionStore(Submissions);
  let server;
  try {
    await t.test("repeat initialization inserts exactly eight and preserves unrelated data", async () => {
      const extra = await Students.create({ userId: "unrelated", name: "Keep", email: "keep@example.invalid" });
      assert.deepEqual(await seedDemo({ Student: Students, Submission: Submissions }), { students: 8, submissions: 8 });
      assert.deepEqual(await seedDemo({ Student: Students, Submission: Submissions }), { students: 8, submissions: 8 });
      assert.ok(await Students.findById(extra._id));
    });
    const alice = await Students.create({ userId: "test_alice", name: "測試學生", email: "alice@example.invalid", className: "測試班" });
    const bob = await Students.create({ userId: "test_bob", name: "其他學生", email: "bob@example.invalid" });
    await Students.create({ userId: "test_teacher", name: "測試教師", role: "teacher", email: "teacher@example.invalid" });
    // 實際評分處理器使用內建 Q001 標準答案；禁用本測試的外部 AI 呼叫。
    // 真正的資料庫寫入仍透過同一個 store，指向本次獨立測試集合。
    const isolatedKeys = ["NODE_ENV", "MONGO", "MONGODB_URI", "MONGO_URI", "MONGO_URL", "GEMINI_API_KEY"];
    const environment = Object.fromEntries(isolatedKeys.map((key) => [key, process.env[key]]));
    for (const key of isolatedKeys) process.env[key] = key === "NODE_ENV" ? "production" : "";
    t.after(() => { for (const key of isolatedKeys) {
      if (environment[key] === undefined) delete process.env[key]; else process.env[key] = environment[key];
    } });
    const { compareStage1, compareStage2, compareStage3 } = await import("../index.js");
    const app = express();
    app.use(express.json());
    // 只有此測試程式接受測試身分標頭，正式 app 使用 Clerk JWT。
    app.use((req, res, next) => { req.auth = () => ({ userId: req.get("X-Test-User") || null }); next(); });
    registerSubmissionRoutes(app, {
      ensureStudent: (userId) => Students.findOne({ userId }).lean(),
      requireTeacher: createRequireTeacher({ StudentModel: Students, dbReady: () => true }),
      requireDb: (req, res, next) => next(), store,
    });
    app.post("/api/submissions/stage1/compare", compareStage1);
    app.post("/api/submissions/stage2/compare", compareStage2);
    app.post("/api/submissions/stage3/compare", compareStage3);
    registerActivityRoutes(app, { ensureStudent: (userId) => Students.findOne({userId}).lean(), isDbReady: () => true, store,
      chatReply: async () => "測試對話回覆", hintReply: async () => "測試提示回覆" });
    app.use((err, req, res, next) => { res.status(err.status || 500).json({ success: false, error: err.message }); });
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function request(path, user, body, operation = "operation-test-0001") {
      const res = await fetch(origin + path, { method: body ? "POST" : "GET", headers: {
        ...(user ? { "X-Test-User": user } : {}), "Content-Type": "application/json", "Idempotency-Key": operation,
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, data: await res.json() };
    }
    const payload = { questionId: "Q001", code: 'weather = input()\nif weather == "下雨":\n    print("帶傘")\nelse:\n    print("不帶傘")', language: "python", durationDeltaSec: 12 };
    await t.test("concurrent retries create one submission and count duration once", async () => {
      const results = await Promise.all(Array.from({ length: 4 }, () => request("/api/submissions/stage3", "test_alice", payload)));
      assert.ok(results.every((r) => r.status === 200));
      assert.equal(new Set(results.map((r) => r.data.submissionId)).size, 1);
      const docs = await Submissions.find({ student: alice._id });
      assert.equal(docs.length, 1);
      assert.equal(docs[0].stages.stage3.durationSec, 12);
      assert.equal(docs[0].stages.stage3.code, payload.code);
      assert.equal(docs[0].stages.stage3.score, null);
    });
    await t.test("fresh API read restores persisted answer; another student cannot read or impersonate owner", async () => {
      const own = await request("/api/submissions/mine?questionId=Q001", "test_alice");
      assert.equal(own.data.item.stages.stage3.code, payload.code);
      assert.equal((await request(`/api/submissions/mine?questionId=Q001&studentId=${alice._id}`, "test_bob")).data.item, null);
      assert.equal((await request("/api/submissions/stage3", "test_bob", { ...payload, studentId: String(alice._id) })).status, 403);
      assert.equal(await Submissions.countDocuments({ student: bob._id }), 0);
      assert.equal((await request("/api/submissions/stage3", null, payload)).status, 401);
    });
    await t.test("same request id with different content is rejected without changing saved answer", async () => {
      assert.equal((await request("/api/submissions/stage3", "test_alice", { ...payload, code: "print(0)" })).status, 409);
      assert.equal((await Submissions.findOne({ student: alice._id })).stages.stage3.code, payload.code);
    });
    const gradeBody = { ...payload, question: "判斷是否下雨並決定帶傘", durationDeltaSec: 0 };
    await t.test("actual grading HTTP handler persists returned score; retry replays saved result and teacher API reads it", async () => {
      const grade = await request("/api/submissions/stage3/compare", "test_alice", gradeBody, "grade-test-0001");
      assert.equal(grade.status, 200);
      assert.ok(Number.isFinite(grade.data.scores.overall));
      const retry = await request("/api/submissions/stage3/compare", "test_alice", gradeBody, "grade-test-0001");
      assert.equal(retry.status, 200); assert.equal(retry.data.replayed, true);
      assert.deepEqual(retry.data.scores, grade.data.scores);
      const teacher = await request("/api/admin/submissions?questionId=Q001", "test_teacher");
      assert.equal(teacher.status, 200);
      const item = teacher.data.items.find((s) => s.student._id === String(alice._id));
      assert.equal(item.stages.stage3.score, grade.data.scores.overall);
      assert.equal(item.stages.stage3.feedback, grade.data.feedback);
      assert.equal(item.stages.stage3.checkReport, grade.data.checkReport);
      assert.equal(item.attemptCount, 1);
      assert.equal(item.operations, undefined);
      assert.equal(teacher.data.items.filter((s) => s.isDemo).length, 8);
      assert.equal((await request("/api/admin/submissions", "test_alice")).status, 403);
      assert.equal((await request("/api/admin/submissions", null)).status, 401);
    });
    await t.test("editing a graded answer clears the outdated score, preserving other stages", async () => {
      const result = await request("/api/submissions/stage2", "test_alice", { questionId: "Q001", pseudocode: "BEGIN\nEND" }, "stage2-test-0001");
      assert.equal(result.status, 200);
      assert.equal((await Submissions.findOne({ student: alice._id })).attemptCount, 1);
      await request("/api/submissions/stage3", "test_alice", { ...payload, code: "print(2)" }, "edit-test-0001");
      const doc = await Submissions.findOne({ student: alice._id });
      assert.equal(doc.stages.stage3.score, null);
      assert.equal(doc.stages.stage3.completed, false);
      assert.equal(doc.stages.stage2.pseudocode, "BEGIN\nEND");
    });
    await t.test("retrying an old grade after editing returns conflict instead of a stale success", async () => {
      assert.equal((await request("/api/submissions/stage3/compare", "test_alice", gradeBody, "grade-test-0001")).status, 409);
      assert.equal((await Submissions.findOne({ student: alice._id })).stages.stage3.code, "print(2)");
    });
    await t.test("flowchart saves and retry time remain visible to teacher alongside code", async () => {
      const body = { questionId: "Q001", graph: { nodes: [{ id: "n1", data: { label: "開始" } }], edges: [] }, durationDeltaSec: 8, score: 100, completed: true };
      const first = await request("/api/submissions/stage1", "test_alice", body, "graph-test-0001");
      const second = await request("/api/submissions/stage1", "test_alice", body, "graph-test-0001");
      assert.equal(first.status, 200); assert.equal(second.data.replayed, true);
      const doc = await Submissions.findOne({ student: alice._id });
      assert.equal(doc.stages.stage1.durationSec, 8);
      assert.equal(doc.stages.stage1.score, null);
      assert.equal(doc.stages.stage1.completed, false);
      assert.equal(doc.stages.stage3.code, "print(2)");
    });
    await t.test("slow grading cannot overwrite a newer saved answer", async () => {
      await assert.rejects(store.save({ student: alice, stage: 3, body: payload, operationId: "stale-grade-0001",
        startedAt: new Date(0), evaluation: { score: 99, completed: true } }), (e) => e.status === 409);
      assert.equal((await Submissions.findOne({ student: alice._id })).stages.stage3.code, "print(2)");
    });
    await t.test("flowchart and pseudocode HTTP grades persist results that teacher API can retrieve", async () => {
      const example = buildDemoData()[0].submission;
      for (const [stage, answer] of [
        [1, { graph: example.stages.stage1.graph }],
        [2, { pseudocode: example.stages.stage2.pseudocode }],
      ]) {
        const grade = await request(`/api/submissions/stage${stage}/compare`, "test_alice",
          { questionId: "Q001", question: "判斷是否下雨並決定帶傘", ...answer }, `http-grade-stage${stage}-0001`);
        assert.equal(grade.status, 200);
        assert.ok(Number.isFinite(grade.data.scores.overall));
        const teacher = await request("/api/admin/submissions?questionId=Q001", "test_teacher");
        const item = teacher.data.items.find((s) => s.student._id === String(alice._id));
        assert.equal(item.stages[`stage${stage}`].score, grade.data.scores.overall);
        assert.equal(item.stages[`stage${stage}`].checkReport, grade.data.checkReport);
      }
    });
    await t.test("grading write failure returns 503 without reporting success or changing the saved answer", async () => {
      const before = await Submissions.findOne({ student: alice._id }).lean();
      const originalSave = store.save;
      store.save = async () => { throw Object.assign(new Error("simulated connection failure"), { name: "MongoNetworkError" }); };
      try {
        const result = await request("/api/submissions/stage3/compare", "test_alice", gradeBody, "failed-write-0001");
        assert.equal(result.status, 503); assert.equal(result.data.success, false);
      } finally { store.save = originalSave; }
      const after = await Submissions.findOne({ student: alice._id }).lean();
      assert.equal(after.stages.stage3.code, before.stages.stage3.code);
      assert.equal(after.attemptCount, before.attemptCount);
    });
    await t.test("demo source filters sort 01-08; pagination statistics cover all filtered records", async () => {
      const result=await request("/api/admin/submissions?source=demo&className="+encodeURIComponent("示範班")+"&topic="+encodeURIComponent("邏輯訓練")+"&questionId=Q001&pageSize=4&page=2","test_teacher");
      assert.equal(result.status,200); assert.equal(result.data.total,8);
      assert.deepEqual(result.data.items.map(r=>r.student.name),["示範學生05","示範學生06","示範學生07","示範學生08"]);
      assert.equal(result.data.statistics.demo.studentCount,8);
      assert.equal(result.data.statistics.demo.completedStudents,5);
      assert.equal(result.data.statistics.demo.averageCompletedDurationSec,73*60);
      assert.equal(result.data.statistics.real.studentCount,0);
    });
    await t.test("actual class/topic/question filters distinguish submissions from students", async () => {
      await Submissions.create({student:alice._id,studentName:alice.name,studentEmail:alice.email,questionId:"Q002",topic:"迴圈",questionTitle:"累加練習"});
      const result=await request("/api/admin/submissions?source=real&className="+encodeURIComponent("測試班"),"test_teacher");
      assert.equal(result.data.total,2); assert.equal(result.data.statistics.studentCount,1);
      const filtered=await request("/api/admin/submissions?className="+encodeURIComponent("測試班")+"&topic="+encodeURIComponent("迴圈")+"&questionId=Q002","test_teacher");
      assert.equal(filtered.data.total,1); assert.equal(filtered.data.items[0].questionId,"Q002");
      assert.equal((await request("/api/admin/submissions?className="+encodeURIComponent("不存在班級"),"test_teacher")).data.total,0);
    });
    await t.test("chat, help and attempts are timestamped with idempotent and disjoint counting", async () => {
      const chat={questionId:"Q001",stage:3,prompt:"如何判斷下雨",activityKind:"chat"};
      const first=await request("/api/chat","test_alice",chat,"chat-event-0001");
      const again=await request("/api/chat","test_alice",chat,"chat-event-0001");
      assert.equal(first.status,200); assert.equal(again.data.replayed,true);
      await request("/api/chat","test_alice",{...chat,activityKind:"help",prompt:"接下來我該做什麼"},"help-chat-0001");
      await request("/api/generate-hint","test_alice",{questionId:"Q001",stage:3,question:"下雨是否帶傘",hintLevel:1},"hint-event-0001");
      const doc=await Submissions.findOne({student:alice._id,questionId:"Q001"}).lean();
      assert.equal(doc.chatCount,1); assert.equal(doc.helpCount,2);
      assert.equal(doc.activityEvents.filter(e=>e.kind==='chat').length,1);
      assert.equal(doc.activityEvents.filter(e=>e.kind==='help').length,2);
      assert.equal(doc.activityEvents.filter(e=>e.kind==='attempt').length,doc.attemptCount);
      const summary=await request(`/api/submissions/summary/${alice._id}?questionId=Q001`,"test_teacher");
      assert.equal(summary.status,200); assert.equal(summary.data.data.activity.totals.chat,1);
      assert.equal(summary.data.data.activity.totals.help,2);
      assert.ok(summary.data.data.activity.weekly.slice(0,3).every(w=>w.chat===null));
      assert.equal((await request(`/api/submissions/summary/${alice._id}`,"test_bob")).status,403);
    });
    await t.test("stage1 history stores exact graph versions once and labels legacy snapshot honestly", async () => {
      const before=await Submissions.findOne({student:alice._id,questionId:"Q001"}).lean();
      const last=before.stage1History.length;
      const changed=structuredClone(before.stages.stage1.graph); changed.nodes[0].data.label="修改後的開始";
      const body={questionId:"Q001",graph:changed};
      await request("/api/submissions/stage1","test_alice",body,"history-edit-0001");
      await request("/api/submissions/stage1","test_alice",body,"history-edit-0001");
      const after=await Submissions.findOne({student:alice._id,questionId:"Q001"}).lean();
      assert.equal(after.stage1History.length,last+1);
      assert.equal(after.stage1History.at(-1).graph.nodes[0].data.label,"修改後的開始");
      assert.notEqual(after.stage1History.at(-2).graph.nodes[0].data.label,"修改後的開始");
      await Submissions.create({student:bob._id,studentName:bob.name,studentEmail:bob.email,questionId:"Q001",stages:{stage1:{graph:changed,updatedAt:new Date("2026-10-20T02:00:00Z")}}});
      await request("/api/submissions/stage1","test_bob",{questionId:"Q001",graph:before.stages.stage1.graph},"legacy-history-0001");
      const legacy=await Submissions.findOne({student:bob._id,questionId:"Q001"}).lean();
      assert.equal(legacy.stage1History[0].kind,"legacy-latest");
      assert.equal(legacy.stage1History.length,2);
    });
    await t.test("repeat demo initialization updates fixed timings and history without touching real records", async () => {
      const realBefore=await Submissions.find({isDemo:{$ne:true}}).sort({_id:1}).lean();
      const demo=await Submissions.findOne({isDemo:true}).lean();
      await Submissions.updateOne({_id:demo._id},{$set:{"stages.stage1.durationSec":1}});
      await seedDemo({Student:Students,Submission:Submissions}); await seedDemo({Student:Students,Submission:Submissions});
      assert.deepEqual(await Submissions.find({isDemo:{$ne:true}}).sort({_id:1}).lean(),realBefore);
      assert.equal(await Submissions.countDocuments({isDemo:true}),8);
      const summary=await request(`/api/submissions/summary/${demo.student}?submissionId=${demo._id}`,"test_teacher");
      const record=summary.data.data;
      assert.equal(record.stages.stage1.durationSec,12*60); assert.equal(record.totalDurationSec,104*60);
      assert.deepEqual(record.timingChart.map(r=>r.averageMinutes),[16.25,26,36.25]);
      assert.equal(record.activity.totals.chat,record.activity.weekly.reduce((n,w)=>n+w.chat,0));
      assert.ok(record.analysis.source.includes("示範分析"));
      const row=await Submissions.findById(demo._id).lean(); assert.equal(row.stage1History.length,2);
      assert.notDeepEqual(row.stage1History[0].graph,row.stage1History[1].graph);
    });
    await t.test("AI advice is separate from facts, omits identity and rejects unsupported claims", async () => {
      let prompt;
      const safe=createTeacherReporting(Submissions,{enableAI:()=>true,adviceGenerator:async(text)=>{prompt=text;return "建議逐一核對條件分支，再重新提交驗證。";}});
      const result=await safe.summary(String(alice._id),{questionId:"Q001"});
      assert.ok(result.data.analysis.aiAdvice.includes("建議"));
      assert.ok(!prompt.includes(alice.email)); assert.ok(!prompt.includes(alice.name));
      const unsafe=createTeacherReporting(Submissions,{enableAI:()=>true,adviceGenerator:async()=>"表現優異，所有答案完全正確。"});
      const fallback=await unsafe.summary(String(alice._id),{questionId:"Q001"});
      assert.equal(fallback.data.analysis.aiAdvice,undefined);
      assert.equal(fallback.data.analysis.aiUnavailable,true);
      assert.equal(fallback.data.totalDurationSec,result.data.totalDurationSec);
      assert.deepEqual(fallback.data.activity.totals,result.data.activity.totals);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    // 只清除本次隨機命名的兩個測試集合。
    for (const Model of [Submissions, Students]) {
      assert.ok(Model.collection.name.startsWith(`test_${run}_`));
      await Model.collection.drop().catch((e) => { if (e.code !== 26) throw e; });
    }
    await connection.close();
  }
});
