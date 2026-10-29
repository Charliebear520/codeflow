import { createHash } from "node:crypto";
import mongoose from "mongoose";
import Submission from "../models/Submission.js";
import { createTeacherReporting } from "./teacherReporting.js";
import { extractErrors } from "./learningAnalytics.js";

export const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const submissionIdFor = (studentId, questionId) =>
  new mongoose.Types.ObjectId(digest([String(studentId), questionId]).slice(0, 24));

export function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateRequest(body, operationId) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(operationId || "")) {
    throw requestError(400, "缺少有效的 Idempotency-Key，請重新送出操作");
  }
  if (typeof body.questionId !== "string" || !body.questionId.trim() || body.questionId.length > 100) {
    throw requestError(400, "questionId 必填且不得超過 100 字元");
  }
  if (["student", "studentId", "userId", "studentEmail", "studentName"].some((key) => key in body)) {
    throw requestError(403, "作答只能使用目前登入的學生身分");
  }
}
export function validateOperation(stage, body, operationId) {
  validateRequest(body, operationId);
  if (stage === 1 && !body.graph?.nodes?.length && !body.imageBase64) {
    throw requestError(400, "需提供流程圖或圖片");
  }
  if (stage === 1 && body.graph && (!Array.isArray(body.graph.nodes) || !Array.isArray(body.graph.edges) || body.graph.nodes.length > 500 || body.graph.edges.length > 1000)) {
    throw requestError(400, "流程圖格式不正確或超過節點／連線上限");
  }
  if (stage === 1 && body.imageBase64 && (typeof body.imageBase64 !== "string" || body.imageBase64.length > 4 * 1024 * 1024)) {
    throw requestError(400, "流程圖圖片格式不正確或超過大小上限");
  }
  const text = stage === 2 ? body.pseudocode : body.code;
  if (stage !== 1 && (typeof text !== "string" || !text.trim() || text.length > 100000)) {
    throw requestError(400, "請提供有效作答（最多 100000 字元）");
  }
  if (stage === 3 && body.language && !["python", "javascript", "c"].includes(body.language)) {
    throw requestError(400, "不支援的程式語言");
  }
  if (body.durationDeltaSec != null && (!Number.isSafeInteger(body.durationDeltaSec) || body.durationDeltaSec < 0 || body.durationDeltaSec > 86400)) {
    throw requestError(400, "作答時間必須介於 0 至 86400 秒");
  }
}

export function stageContent(stage, body) {
  if (stage === 1) return {
    ...(body.graph ? { graph: body.graph } : {}),
    ...(body.imageBase64 ? { imageBase64: body.imageBase64.startsWith("data:") ? body.imageBase64 : `data:image/png;base64,${body.imageBase64}` } : {}),
    mode: body.mode || (body.graph ? "editor" : "upload"),
  };
  if (stage === 2) return { pseudocode: body.pseudocode };
  return { code: body.code, language: body.language || "python" };
}

// 測試可傳入獨立連線的 Model；正式 API 不接受外部指定學生或 Model。
export function createSubmissionStore(Model = Submission) {
  const reporting = createTeacherReporting(Model);
  async function ensureRecord(student, questionId) {
    if (!mongoose.isValidObjectId(student?._id)) throw requestError(503, "無法確認學生資料，尚未儲存");
    const owner = { student: student._id, questionId };
    const existing = await Model.findOne(owner).lean();
    const id = existing?._id || submissionIdFor(student._id, questionId);
    if (!existing) {
      const q = Model.db.models.Question ? await Model.db.models.Question.findOne({ $or: [
        { questionId }, { questionTitle: questionId }, ...(mongoose.isValidObjectId(questionId) ? [{ _id: questionId }] : []),
      ] }).lean() : null;
      try {
        await Model.updateOne({ _id: id }, { $setOnInsert: { ...owner, createdAt: new Date(), activityTrackingStartedAt: new Date(),
          studentName: student.name || "學生", studentEmail: student.email || `${student.userId}@users.invalid`,
          topic: q?.topic || (questionId === "Q001" ? "邏輯訓練" : "未分類"), questionTitle: q?.questionTitle || questionId,
        } }, { upsert: true, runValidators: true, timestamps: false });
      } catch (error) { if (error.code !== 11000) throw error; }
    }
    return { existing, id };
  }
  function sameContent(stage, body, savedStage) {
    return Object.entries(stageContent(stage, body)).every(([key, value]) =>
      JSON.stringify(savedStage?.[key]) === JSON.stringify(value));
  }

  async function replay({ student, stage, body, operationId }) {
    const doc = await Model.findOne({ student: student._id, questionId: body.questionId }).lean();
    const hash = doc?.operations?.[digest([stage, "compare", operationId])];
    if (!hash) return null;
    if (hash !== digest(body)) throw requestError(409, "同一操作識別碼不能用於不同內容，請重新操作");
    const saved = doc.stages?.[`stage${stage}`];
    if (!sameContent(stage, body, saved) || !saved?.scores) throw requestError(409, "作答已更新，請重新檢查目前內容");
    return { success: true, replayed: true, submissionId: doc._id,
      scores: saved.scores, diffs: saved.diffs, feedback: saved.feedback, checkReport: saved.checkReport };
  }

  async function save({ student, stage, body, operationId, evaluation = null, startedAt = null }) {
    validateOperation(stage, body, operationId);
    const { existing, id } = await ensureRecord(student, body.questionId);
    const opKey = digest([stage, evaluation ? "compare" : "save", operationId]);
    const requestHash = digest(body);
    const prefix = `stages.stage${stage}`;
    const content = stageContent(stage, body);
    const previousStage = existing?.stages?.[`stage${stage}`] || {};
    const changed = Object.entries(content).some(([key, value]) =>
      JSON.stringify(previousStage[key]) !== JSON.stringify(value));
    const set = {
      [`operations.${opKey}`]: requestHash,
      studentName: student.name || "學生",
      studentEmail: student.email || `${student.userId}@users.invalid`,
      [`${prefix}.updatedAt`]: new Date(),
    };
    if (!existing?.activityTrackingStartedAt) set.activityTrackingStartedAt = new Date();
    for (const [key, value] of Object.entries(content)) set[`${prefix}.${key}`] = value;
    if (evaluation) {
      for (const [key, value] of Object.entries(evaluation)) set[`${prefix}.${key}`] = value;
    } else if (changed) {
      // 學生不可自行指定分數或 completed；修改答案後原評分不再適用。
      for (const [key, value] of Object.entries({ score: null, scores: null, diffs: null, feedback: "", checkReport: "", completed: false })) {
        set[`${prefix}.${key}`] = value;
      }
    }
    const filter = { _id: id, student: student._id, [`operations.${opKey}`]: { $exists: false } };
    if (evaluation && startedAt) filter.$or = [
      { [`${prefix}.updatedAt`]: { $lte: startedAt } },
      { [`${prefix}.updatedAt`]: null },
    ];
    const push = {};
    if (evaluation) push.activityEvents = { operationId: opKey, kind: "attempt", stage, at: new Date(), isDemo: false, issues: extractErrors(evaluation.diffs) };
    if (stage === 1) {
      const history = [];
      if (!existing?.stage1History?.length && (previousStage.graph?.nodes?.length || previousStage.imageBase64)) {
        const baseline = { operationId: `baseline-${id}`, kind: "legacy-latest", at: previousStage.updatedAt || null,
          graph: previousStage.graph, imageBase64: previousStage.graph?.nodes?.length ? undefined : previousStage.imageBase64,
          score: previousStage.score, completed: previousStage.completed, isDemo: !!existing.isDemo };
        // 首次啟用歷史時只保留一份已知快照；缺少原提交時間時不借用其他更新時間。
        await Model.updateOne({ _id: id, student: student._id, "stage1History.0": { $exists: false } },
          { $push: { stage1History: baseline } }, { runValidators: true, timestamps: false });
      }
      history.push({ operationId: opKey, kind: evaluation ? "compare" : "save", at: new Date(),
        graph: content.graph, imageBase64: content.graph?.nodes?.length ? undefined : content.imageBase64,
        score: evaluation?.score ?? (changed ? null : previousStage.score ?? null), completed: evaluation?.completed ?? (!changed && !!previousStage.completed), isDemo: false });
      push.stage1History = { $each: history };
    }
    const updated = await Model.findOneAndUpdate(
      filter,
      { $set: set, $inc: { [`${prefix}.durationSec`]: body.durationDeltaSec || 0, attemptCount: evaluation ? 1 : 0 }, ...(Object.keys(push).length ? { $push: push } : {}) },
      { new: true, runValidators: true },
    ).lean();
    const doc = updated || await Model.findOne({ _id: id, student: student._id }).lean();
    if (!doc) throw requestError(503, "儲存未完成，請重試");
    if (!updated && doc.operations?.[opKey] !== requestHash) {
      if (evaluation && startedAt && !doc.operations?.[opKey]) throw requestError(409, "已有較新的作答，請重新檢查目前內容");
      throw requestError(409, "同一操作識別碼不能用於不同內容，請重新操作");
    }
    if (!updated && evaluation && !sameContent(stage, body, doc.stages?.[`stage${stage}`])) {
      throw requestError(409, "作答已更新，請重新檢查目前內容");
    }
    return { doc, replayed: !updated };
  }

  async function mine(student, questionId) {
    return Model.findOne({ student: student._id, questionId }).select("-operations -activityEvents -stage1History").lean();
  }

  async function activityReplay({ student, body, operationId, kind }) {
    validateRequest(body, operationId);
    if (!["chat", "help"].includes(kind)) throw requestError(400, "不支援的操作類型");
    const doc = await Model.findOne({ student: student._id, questionId: body.questionId }).lean();
    const key = digest(["activity", kind, operationId]);
    if (!doc?.operations?.[key]) return null;
    if (doc.operations[key] !== digest(body)) throw requestError(409, "同一操作識別碼不能用於不同內容");
    return { doc, event: doc.activityEvents.find((e) => e.operationId === key), replayed: true };
  }
  async function recordActivity({ student, body, operationId, kind, responseText }) {
    validateRequest(body, operationId);
    if (!["chat", "help"].includes(kind)) throw requestError(400, "不支援的操作類型");
    const { existing, id } = await ensureRecord(student, body.questionId);
    const key = digest(["activity", kind, operationId]);
    const set = { [`operations.${key}`]: digest(body) };
    if (!existing?.activityTrackingStartedAt) set.activityTrackingStartedAt = new Date();
    const event = { operationId: key, kind, stage: Number(body.stage) || 1, at: new Date(), isDemo: false, responseText };
    const doc = await Model.findOneAndUpdate({ _id: id, student: student._id, [`operations.${key}`]: { $exists: false } },
      { $set: set, $inc: { [kind === "chat" ? "chatCount" : "helpCount"]: 1 }, $push: { activityEvents: event } }, { new: true, runValidators: true }).lean();
    if (doc) return { doc, event, replayed: false };
    const replayed = await activityReplay({ student, body, operationId, kind });
    if (!replayed) throw requestError(503, "操作紀錄尚未保存，請重試");
    return replayed;
  }

  return { save, mine, list: reporting.list, summary: reporting.summary, replay, activityReplay, recordActivity };
}

export const submissionStore = createSubmissionStore();
