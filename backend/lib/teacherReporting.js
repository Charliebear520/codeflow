import mongoose from "mongoose";
import { activitySummary, groupStatistics, recordAnalysis, stageKeys, totalSeconds } from "./learningAnalytics.js";
import { generateContent } from "../services/geminiService.js";

const fail = (status, message) => Object.assign(new Error(message), { status });
const unassigned = "未分班";
const uncategorized = "未分類";
export function createTeacherReporting(Model, { adviceGenerator = generateContent, enableAI = () => !!process.env.GEMINI_API_KEY } = {}) {
  async function catalog() {
    const [rows, questions] = await Promise.all([
      Model.find({}).select("student studentName questionId topic questionTitle isDemo stages.stage1.durationSec stages.stage2.durationSec stages.stage3.durationSec stages.stage1.completed stages.stage2.completed stages.stage3.completed updatedAt")
        .populate("student", "name email className isDemo").lean(),
      Model.db.models.Question ? Model.db.models.Question.find({}).select("questionId questionTitle topic").lean() : [],
    ]);
    return rows.map((r) => {
      const q = questions.find((q) => [q.questionId, String(q._id), q.questionTitle].includes(r.questionId));
      return { ...r, className: r.student?.className || unassigned,
        topic: q?.topic || r.topic || (r.questionId === "Q001" ? "邏輯訓練" : uncategorized),
        questionTitle: q?.questionTitle || r.questionTitle || r.questionId };
    });
  }
  function selected(rows, query) {
    for (const key of ["className", "topic", "questionId", "source", "stage", "studentId"]) {
      if (query[key] !== undefined && typeof query[key] !== "string") throw fail(400, "篩選值必須是文字");
    }
    if (query.studentId && !mongoose.isValidObjectId(query.studentId)) throw fail(400, "invalid studentId");
    return rows.filter((r) => (!query.className || query.className === "all" || r.className === query.className)
      && (!query.topic || query.topic === "all" || r.topic === query.topic)
      && (!query.questionId || query.questionId === "all" || r.questionId === query.questionId)
      && (!query.studentId || String(r.student?._id) === query.studentId)
      && (!query.source || query.source === "all" || (query.source === "demo" ? r.isDemo === true : r.isDemo !== true))
      && (!stageKeys.includes(query.stage) || r.stages?.[query.stage]?.completed === true));
  }
  async function list(query = {}) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 20)));
    const all = await catalog();
    const rows = selected(all, query).sort((a, b) => {
      if (a.isDemo && b.isDemo) return (a.student?.name || a.studentName).localeCompare(b.student?.name || b.studentName, "zh-TW", { numeric: true }) || a.questionId.localeCompare(b.questionId);
      if (!!a.isDemo !== !!b.isDemo) return a.isDemo ? 1 : -1;
      return new Date(b.updatedAt) - new Date(a.updatedAt) || String(a._id).localeCompare(String(b._id));
    });
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    const docs = await Model.find({ _id: { $in: pageRows.map((r) => r._id) } }).select("-operations -activityEvents")
      .populate("student", "name email className isDemo").lean();
    const unique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-TW", { numeric: true }));
    const classRows = selected(all, { className: query.className });
    const topicRows = selected(all, { className: query.className, topic: query.topic });
    return { success: true, items: pageRows.map((r) => ({ ...docs.find((d) => String(d._id) === String(r._id)), topic: r.topic, className: r.className, questionTitle: r.questionTitle })),
      total: rows.length, page, pageSize, statistics: groupStatistics(rows),
      options: { classes: unique(all.map((r) => r.className)), topics: unique(classRows.map((r) => r.topic)),
        questions: [...new Map(topicRows.map((r) => [r.questionId, { value: r.questionId, label: `${r.questionId} · ${r.questionTitle}` }])).values()] } };
  }
  async function summary(studentId, query = {}) {
    if (!mongoose.isValidObjectId(studentId)) throw fail(400, "invalid studentId");
    const filter = { student: studentId };
    if (query.submissionId) {
      if (!mongoose.isValidObjectId(query.submissionId)) throw fail(400, "invalid submissionId");
      filter._id = query.submissionId;
    }
    if (query.questionId) {
      if (typeof query.questionId !== "string") throw fail(400, "invalid questionId");
      filter.questionId = query.questionId;
    }
    const doc = await Model.findOne(filter).select("-operations").sort({ updatedAt: -1 }).populate("student", "name className").lean();
    if (!doc) throw fail(404, "找不到該學生的作答紀錄");
    const all = await catalog();
    const meta = all.find((r) => String(r._id) === String(doc._id));
    const cohort = all.filter((r) => r.className === meta.className && r.topic === meta.topic && r.questionId === doc.questionId && !!r.isDemo === !!doc.isDemo);
    const timingChart = stageKeys.map((key, index) => {
      const timed = cohort.filter((r) => Number(r.stages?.[key]?.durationSec) > 0);
      return { name: `階段${["一", "二", "三"][index]}`, studentMinutes: (doc.stages?.[key]?.durationSec || 0) / 60,
        averageMinutes: timed.length ? timed.reduce((n, r) => n + r.stages[key].durationSec, 0) / timed.length / 60 : null,
        sampleCount: timed.length };
    });
    const activity = activitySummary(doc);
    const analysis = recordAnalysis(doc, activity);
    if (!doc.isDemo && enableAI()) {
      try {
        const advice = (await adviceGenerator(`你是審慎的程式教學助教。請依以下已保存資料，用繁體中文提供兩句學習建議。
不要重述數字，不要評定學生能力，不要根據用時判斷表現，不要斷言答案正確或沒有錯誤。
沒有錯誤紀錄只能說資料不足，不能捏造錯誤。只提建議，不寫讚美或評級。
評分與完成狀態：${JSON.stringify(stageKeys.map(key=>({score:doc.stages?.[key]?.score??null,completed:!!doc.stages?.[key]?.completed})))}
已保存問題：${JSON.stringify(analysis.errors)}
本期間操作：${JSON.stringify(activity.totals)}`)).trim();
        if (!advice || /\d|速度|用時|耗時|能力|優異|優秀|完全正確|沒有錯誤|無錯誤|優於平均/.test(advice)) throw new Error("Advice requires review");
        analysis.aiAdvice = advice;
        analysis.source = "依目前紀錄計算＋即時 AI 學習建議";
      } catch {
        analysis.aiUnavailable = true;
      }
    }
    return { success: true, data: { submissionId: doc._id, questionId: doc.questionId, questionTitle: meta.questionTitle,
      isDemo: !!doc.isDemo, stages: doc.stages, totalDurationSec: totalSeconds(doc), activity,
      analysis, timingChart,
      cohort: { className: meta.className, topic: meta.topic, isDemo: !!doc.isDemo, submissionCount: cohort.length },
      updatedAt: doc.updatedAt } };
  }
  return { list, summary };
}
