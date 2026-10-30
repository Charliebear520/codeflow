// 助教對話 / 提示：資料庫無法連線時仍應回覆（不保存紀錄）
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerActivityRoutes } from "../lib/activityRoutes.js";

async function startApp({ chatReply, hintReply }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.auth = () => ({ userId: "user_test" }); next(); });
  const store = {
    activityReplay: async () => { throw new Error("資料庫斷線時不應呼叫 store"); },
    recordActivity: async () => { throw new Error("資料庫斷線時不應呼叫 store"); },
  };
  registerActivityRoutes(app, { ensureStudent: async () => ({ _id: "s1" }), isDbReady: () => false, chatReply, hintReply, store });
  app.use((err, req, res, next) => res.status(err.status || 500).json({ success: false, error: err.message }));
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const post = (url, path, body) => fetch(url + path, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": "11111111-1111-4111-8111-111111111111" },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

test("資料庫斷線時 /api/chat 與 /api/generate-hint 仍回傳 AI 回覆（persisted: false）", async (t) => {
  const { server, url } = await startApp({ chatReply: async () => "AI 助教回覆", hintReply: async () => "AI 提示" });
  t.after(() => server.close());
  const chat = await post(url, "/api/chat", { prompt: "菱形要放什麼？", questionId: "Q001", stage: 1 });
  assert.equal(chat.status, 200);
  assert.deepEqual([chat.body.result, chat.body.persisted, chat.body.fallback], ["AI 助教回覆", false, false]);
  const hint = await post(url, "/api/generate-hint", { question: "判斷成績是否及格", hintLevel: 1, questionId: "Q001", stage: 2 });
  assert.equal(hint.status, 200);
  assert.equal(hint.body.hint, "AI 提示");
});

test("Gemini 失敗時改回基本提示並標示 fallback", async (t) => {
  const { server, url } = await startApp({ chatReply: async () => { throw new Error("timeout"); }, hintReply: async () => "x" });
  t.after(() => server.close());
  const chat = await post(url, "/api/chat", { prompt: "你好", questionId: "Q001" });
  assert.equal(chat.status, 200);
  assert.equal(chat.body.fallback, true);
  assert.match(chat.body.result, /基本提示/);
});
