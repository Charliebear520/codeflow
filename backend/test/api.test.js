// 後端 API 整合測試：以「必定連不上」的 MongoDB 位址啟動，
// 驗證資料庫故障時各 API 都能在 Vercel 10 秒上限內回傳 JSON，且權限檢查正確。
// 執行：cd backend && npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.NODE_ENV = "production"; // 正式模式：不自動 listen、不讀 .env
process.env.MONGO = "mongodb://user:pw@unreachable.invalid:27017/codeflow_test";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/codeflow"; // 模擬 Vercel 上的錯誤設定

const { default: app } = await import("../index.js");
const db = await import("../lib/db.js");
const { isTeacherOrgRole } = await import("../lib/roles.js");

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

async function request(path, options = {}) {
  const startedAt = Date.now();
  const res = await fetch(baseUrl + path, options);
  const ms = Date.now() - startedAt;
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  return { status: res.status, isJson, body, ms };
}

// ---- lib/db.js ----

test("正式環境略過指向 localhost 的 URI，採用 MONGO", () => {
  const { uri, source } = db.resolveMongoUri();
  assert.equal(source, "MONGO");
  assert.match(uri, /unreachable\.invalid/);
});

test("正式環境只有 localhost URI 時不採用任何連線字串", () => {
  const saved = process.env.MONGO;
  delete process.env.MONGO;
  try {
    assert.deepEqual(db.resolveMongoUri(), { uri: "", source: null });
  } finally {
    process.env.MONGO = saved;
  }
});

test("開發環境沒有任何設定時 fallback 到本機", () => {
  const saved = { ...process.env };
  process.env.NODE_ENV = "development";
  for (const key of db.MONGO_URI_ENV_KEYS) delete process.env[key];
  try {
    assert.equal(db.resolveMongoUri().source, "local-fallback");
  } finally {
    Object.assign(process.env, saved);
  }
});

test("isLocalMongoUri 判斷含帳密的本機位址", () => {
  assert.ok(db.isLocalMongoUri("mongodb://localhost:27017/x"));
  assert.ok(db.isLocalMongoUri("mongodb://u:p@127.0.0.1:27017/x"));
  assert.ok(!db.isLocalMongoUri("mongodb+srv://u:p@cluster0.abc.mongodb.net/x"));
});

test("isDbError 辨識連線失敗與排隊逾時", () => {
  assert.ok(db.isDbError({ name: "MongooseServerSelectionError" }));
  assert.ok(db.isDbError(new Error("Operation `x.find()` buffering timed out after 3000ms")));
  assert.ok(!db.isDbError(new Error("validation failed")));
});

// ---- lib/roles.js ----

test("教師 Organization 角色判斷", () => {
  for (const role of ["org:teacher", "teacher", "org:admin", "admin"]) {
    assert.ok(isTeacherOrgRole(role), role);
  }
  for (const role of ["org:member", "student", undefined, null]) {
    assert.ok(!isTeacherOrgRole(role), String(role));
  }
});

// ---- HTTP ----

test("/api/status 顯示診斷資訊且不洩漏帳密", async () => {
  const { status, body } = await request("/api/status");
  assert.equal(status, 200);
  assert.equal(body.mongodb.uriSource, "MONGO");
  assert.deepEqual(body.mongodb.skippedLocal, ["MONGO_URI"]);
  assert.ok(!JSON.stringify(body).includes("pw@"), "回應中不應包含密碼");
});

const unauthorizedCases = [
  ["GET", "/api/admin/submissions"],
  ["GET", "/api/submissions/stage1"],
  ["GET", "/api/submissions/stage2"],
  ["GET", "/api/submissions/stage3"],
  ["GET", "/api/submissions/summary/0123456789abcdef01234567"],
  ["POST", "/api/add-question"],
  ["GET", "/api/debug-submissions"],
  ["GET", "/api/test-env"],
  ["POST", "/api/chat"],
  ["POST", "/api/generate-hint"],
  ["GET", "/api/submissions/mine?questionId=Q001"],
  ...[1, 2, 3].flatMap((stage) => [
    ["POST", `/api/submissions/stage${stage}`],
    ["POST", `/api/submissions/stage${stage}/compare`],
  ]),
];

for (const [method, path] of unauthorizedCases) {
  test(`${method} ${path} 未登入回 401 JSON`, async () => {
    const { status, isJson, ms } = await request(path, { method });
    assert.equal(status, 401);
    assert.ok(isJson);
    assert.ok(ms < 8000, `回應時間 ${ms}ms 超過上限`);
  });
}

test("/api/me 未登入回 401 JSON", async () => {
  const { status, isJson } = await request("/api/me");
  assert.equal(status, 401);
  assert.ok(isJson);
});

test("資料庫未連線時 /api/questions 立即回 503 JSON", async () => {
  const { status, body, ms } = await request("/api/questions");
  assert.equal(status, 503);
  assert.equal(body.error, db.DB_UNAVAILABLE_MESSAGE);
  assert.ok(ms < 8000, `回應時間 ${ms}ms 超過上限`);
});

test("/api/upload 在 ImageKit 停用時回 501 JSON", async () => {
  const { status, isJson } = await request("/api/upload");
  assert.equal(status, 501);
  assert.ok(isJson);
});

test("已移除的 /api/test-insert 不存在", async () => {
  const { status } = await request("/api/test-insert");
  assert.ok(status === 401 || status === 404); // 正式環境先被教師檢查攔下
});
