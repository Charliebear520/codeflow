import { submissionStore, requestError, validateRequest } from "./submissionStore.js";

export function registerActivityRoutes(app, { ensureStudent, requireDb, chatReply, hintReply, store = submissionStore }) {
  const signedIn = (req, res, next) => req.auth?.()?.userId ? next() : res.status(401).json({ success: false, error: "請先登入" });
  for (const type of ["chat", "hint"]) {
    app.post(type === "chat" ? "/api/chat" : "/api/generate-hint", signedIn, requireDb, async (req, res, next) => {
      try {
        const body = req.body || {};
        validateRequest(body, req.get("Idempotency-Key"));
        const prompt = type === "chat" ? body.prompt : body.question;
        if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 10000) throw requestError(400, "請提供有效的提問內容");
        if (body.activityKind && !["chat", "help"].includes(body.activityKind)) throw requestError(400, "不支援的操作類型");
        if (body.stage && ![1, 2, 3].includes(Number(body.stage))) throw requestError(400, "無效階段");
        const kind = type === "hint" || body.activityKind === "help" ? "help" : "chat";
        const student = await ensureStudent(req.auth().userId);
        let saved = await store.activityReplay({ student, body, kind, operationId: req.get("Idempotency-Key") });
        let fallback = false;
        if (!saved) {
          let responseText;
          try { responseText = await (type === "chat" ? chatReply(body) : hintReply(body)); }
          catch { fallback = true; responseText = "請先對照題目檢查輸入、條件分支與輸出，再確認每個分支是否都有結束步驟。（基本提示，非即時 AI 回覆）"; }
          if (!responseText) throw requestError(503, "尚未取得回覆，請重試");
          saved = await store.recordActivity({ student, body, kind, responseText, operationId: req.get("Idempotency-Key") });
        }
        res.json({ success: true, submissionId: saved.doc._id, replayed: saved.replayed, fallback,
          [type === "chat" ? "result" : "hint"]: saved.event?.responseText || "此操作已記錄" });
      } catch (error) { next(error); }
    });
  }
}
