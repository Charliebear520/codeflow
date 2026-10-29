import mongoose from "mongoose";

export const DEMO_BATCH = "codeflow-demo-v1";
export const DEMO_DATABASE = "codeflow_demo";
export const DEMO_MINUTES = [[12,34,58],[8,19,31],[24,11,43],[17,46,22],[6,15,27],[31,18,52],[22,39,16],[10,26,41]];
const WEEK_COUNTS = {
  chat: [[4,9,5,12],[7,3,10,6],[2,8,6,11],[9,5,12,7],[3,6,4,8],[8,12,5,10],[6,10,7,4],[5,3,9,13]],
  attempt: [[2,6,3,8],[5,2,7,4],[3,5,4,7],[6,3,8,5],[2,4,3,6],[5,8,4,7],[4,7,5,3],[3,2,6,8]],
  help: [[1,3,2,4],[2,1,4,2],[1,4,2,3],[4,2,5,3],[1,2,1,3],[3,5,2,4],[2,4,3,1],[2,1,3,4]],
};
function demoEvents(index) {
  const events = [];
  for (const kind of Object.keys(WEEK_COUNTS)) for (let week = 0; week < 4; week++) {
    for (let n = 0; n < WEEK_COUNTS[kind][index][week]; n++) events.push({
      operationId: `demo-${index + 1}-${kind}-${week}-${n}`, kind, stage: n % 3 + 1,
      at: new Date(Date.UTC(2026, 9, 5 + week * 7 + (n + index) % 4, 2, n)), isDemo: true,
      issues: kind === "attempt" && (n + index) % 5 === 0 ? ["示範：條件分支需要再次檢查"] : [],
    });
  }
  return events.sort((a, b) => a.at - b.at);
}
function demoGraph(index, version) {
  const offset = index % 3 * 16;
  const nodes = [
    { id: "start", type: "startEnd", position: { x: 170 + offset, y: 0 }, data: { label: `開始，觀察天氣（${String(index + 1).padStart(2, "0")}）` } },
    { id: "weather", type: "decision", position: { x: 170 + offset, y: 110 }, data: { label: index % 2 ? "外面有下雨嗎？" : "是否下雨？" } },
    { id: "yes", type: "rectangle", position: { x: 10, y: 260 }, data: { label: index % 2 ? "拿雨傘" : "帶上雨傘" } },
    { id: "no", type: "rectangle", position: { x: 340 + offset, y: 260 }, data: { label: "不帶傘" } },
  ];
  const edges = [{ id: "e1", source: "start", target: "weather" }, { id: "e2", source: "weather", target: "yes", label: "是" }];
  if (version > 1) {
    nodes.push({ id: "end", type: "startEnd", position: { x: 170 + offset, y: 410 }, data: { label: "結束，出門" } });
    edges.push({ id: "e3", source: "weather", target: "no", label: "否" }, { id: "e4", source: "yes", target: "end" }, { id: "e5", source: "no", target: "end" });
  }
  return { nodes, edges };
}
export const demoId = (kind, index) => new mongoose.Types.ObjectId(
  `cfde000000000000${kind}${String(index).padStart(6, "0")}`,
);

export function buildDemoData() {
  const names = ["示範學生01", "示範學生02", "示範學生03", "示範學生04", "示範學生05", "示範學生06", "示範學生07", "示範學生08"];
  return names.map((name, index) => {
    const n = index + 1;
    const date = new Date(`2026-10-29T18:${String(10 + index).padStart(2, "0")}:00.000Z`);
    const score = [92, 85, 76, 65, 88, 71, 58, 95][index];
    const feedback = "固定示範回饋，供展示紀錄與評分欄位使用，非即時 AI 評語。";
    const student = { _id: demoId("01", n), userId: `demo_codeflow_v1_${n}`,
      name, email: `student${n}@codeflow.example`, role: "student", className: "示範班",
      isDemo: true, demoBatch: DEMO_BATCH };
    const stage = (offset) => ({ score: score - offset, scores: { overall: score - offset },
      completed: score - offset >= 70, feedback, checkReport: feedback, updatedAt: date, durationSec: DEMO_MINUTES[index][offset / 2] * 60 });
    const submission = { _id: demoId("02", n), student: student._id, studentName: name,
      studentEmail: student.email, questionId: "Q001", isDemo: true, demoBatch: DEMO_BATCH,
      topic: "邏輯訓練", questionTitle: "下雨是否帶傘",
      stages: {
        stage1: { ...stage(0), mode: "editor", graph: {
          nodes: [
            { id: "start", type: "rectangle", position: { x: 120, y: 0 }, data: { label: "開始" } },
            { id: "weather", type: "decision", position: { x: 120, y: 100 }, data: { label: "是否下雨？" } },
            { id: "yes", type: "process", position: { x: 0, y: 220 }, data: { label: "帶傘" } },
            { id: "no", type: "process", position: { x: 240, y: 220 }, data: { label: "不帶傘" } },
          ],
          edges: [{ id: "e1", source: "start", target: "weather" }, { id: "e2", source: "weather", target: "yes", label: "是" }, { id: "e3", source: "weather", target: "no", label: "否" }],
        } },
        stage2: { ...stage(2), pseudocode: 'BEGIN\n  INPUT weather\n  IF weather == "下雨" THEN\n    OUTPUT "帶傘"\n  ELSE\n    OUTPUT "不帶傘"\n  ENDIF\nEND' },
        stage3: { ...stage(4), language: "python", code: 'weather = input("今天會下雨嗎？")\nif weather == "下雨":\n    print("帶傘")\nelse:\n    print("不帶傘")' },
      }, createdAt: date, updatedAt: date };
    submission.stages.stage1.graph = demoGraph(index, 2);
    submission.activityEvents = demoEvents(index);
    submission.activityTrackingStartedAt = new Date("2026-10-04T16:00:00.000Z");
    submission.attemptCount = submission.activityEvents.filter((e) => e.kind === "attempt").length;
    submission.chatCount = submission.activityEvents.filter((e) => e.kind === "chat").length;
    submission.helpCount = submission.activityEvents.filter((e) => e.kind === "help").length;
    submission.stage1History = [1, 2].map((version) => ({ operationId: `demo-${n}-version-${version}`, kind: "demo", isDemo: true,
      at: new Date(date.getTime() - (2 - version) * 3600000), graph: demoGraph(index, version),
      score: version === 1 ? Math.max(0, score - 20) : score, completed: version > 1 && score >= 70 }));
    return { student, submission };
  });
}

export async function seedDemo({ Student, Submission }) {
  if (Submission.db.name !== DEMO_DATABASE || Student.db.name !== DEMO_DATABASE) {
    throw new Error("初始化只允許寫入 codeflow_demo 資料庫");
  }
  const records = buildDemoData();
  // 先檢查全部固定識別碼，避免碰到非示範資料時部分覆寫。
  for (const { student, submission } of records) {
    for (const [Model, doc] of [[Student, student], [Submission, submission]]) {
      const existing = await Model.findById(doc._id).lean();
      if (existing && (!existing.isDemo || existing.demoBatch !== DEMO_BATCH)) {
        throw new Error("固定識別碼已有非本批示範資料，停止初始化");
      }
    }
  }
  for (const { student, submission } of records) {
    await Student.updateOne({ _id: student._id, isDemo: true, demoBatch: DEMO_BATCH }, { $setOnInsert: student }, { upsert: true, runValidators: true, timestamps: false });
    const { stages, topic, questionTitle, activityEvents, activityTrackingStartedAt, stage1History, attemptCount, chatCount, helpCount, updatedAt, ...identity } = submission;
    await Submission.updateOne({ _id: submission._id, isDemo: true, demoBatch: DEMO_BATCH }, {
      $setOnInsert: identity,
      $set: { stages, topic, questionTitle, activityEvents, activityTrackingStartedAt, stage1History, attemptCount, chatCount, helpCount, updatedAt },
    }, { upsert: true, runValidators: true, timestamps: false });
  }
  return { students: await Student.countDocuments({ demoBatch: DEMO_BATCH }), submissions: await Submission.countDocuments({ demoBatch: DEMO_BATCH }) };
}
