import { requestError, validateOperation, submissionStore } from "./submissionStore.js";

export function registerSubmissionRoutes(app, { ensureStudent, requireTeacher, requireDb, store = submissionStore }) {
  const signedIn = (req, res, next) => {
    if (!req.auth?.()?.userId) return res.status(401).json({ success: false, error: "請先登入" });
    next();
  };
  const writer = async (req, res, next) => {
    try {
      const stage = Number(req.originalUrl.match(/stage([123])/)?.[1]);
      validateOperation(stage, req.body || {}, req.get("Idempotency-Key"));
      req.submissionStartedAt = new Date();
      req.submissionStore = store;
      req.submissionStudent = await ensureStudent(req.auth().userId);
      if (!req.submissionStudent?._id) throw requestError(503, "無法確認學生資料");
      if (req.originalUrl.split("?")[0].endsWith("/compare")) {
        const replay = await store.replay({ student: req.submissionStudent, stage,
          body: req.body, operationId: req.get("Idempotency-Key") });
        if (replay) return res.json(replay);
      }
      next();
    } catch (error) { next(error); }
  };
  // 此處先保護既有評分端點，保留原本評分實作並統一持久化方式。
  app.use(/^\/api\/submissions\/stage[123](\/compare)?$/, (req, res, next) => {
    if (req.method !== "POST") return next();
    signedIn(req, res, () => requireDb(req, res, () => writer(req, res, next)));
  });
  for (const stage of [1, 2, 3]) {
    app.post(`/api/submissions/stage${stage}`, async (req, res, next) => {
      try {
        const { doc, replayed } = await store.save({ student: req.submissionStudent, stage,
          body: req.body, operationId: req.get("Idempotency-Key") });
        res.json({ success: true, submissionId: doc._id, replayed,
          durationSec: doc.stages?.[`stage${stage}`]?.durationSec || 0 });
      } catch (error) { next(error); }
    });
  }
  app.get("/api/submissions/mine", signedIn, requireDb, async (req, res, next) => {
    try {
      const student = await ensureStudent(req.auth().userId);
      if (typeof req.query.questionId !== "string" || req.query.questionId.length > 100) throw requestError(400, "questionId 必填");
      const item = await store.mine(student, req.query.questionId);
      res.set("Cache-Control", "no-store").json({ success: true, item });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/submissions", requireTeacher, requireDb, async (req, res, next) => {
    try { res.set("Cache-Control", "no-store").json(await store.list(req.query)); }
    catch (error) { next(error); }
  });
  app.get("/api/submissions/summary/:studentId", requireTeacher, requireDb, async (req, res, next) => {
    try { res.set("Cache-Control", "no-store").json(await store.summary(req.params.studentId, req.query)); }
    catch (error) { next(error); }
  });
}
