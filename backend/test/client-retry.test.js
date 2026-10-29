import { test } from "node:test";
import assert from "node:assert/strict";
import { submissionRequest } from "../../client/src/lib/submissions.js";

test("client retries keep request id/body after lost response, coalesce double clicks and isolate users", async (t) => {
  const storage = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k),
  } });
  t.after(() => { if (oldStorage) Object.defineProperty(globalThis, "sessionStorage", oldStorage); else delete globalThis.sessionStorage; });
  const calls = [];
  const persisted = new Set();
  let loseFirstResponse = true;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ id: options.headers["Idempotency-Key"], body: JSON.parse(options.body) });
    persisted.add(options.headers["Idempotency-Key"]);
    if (loseFirstResponse) { loseFirstResponse = false; throw new TypeError("connection lost after write"); }
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ success: true, submissionId: "test-submission" }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const options = (duration) => ({ method: "POST", headers: { Authorization: "Bearer test-only" },
    body: JSON.stringify({ questionId: "Q001", code: "print(1)", language: "python", durationDeltaSec: duration }) });
  await assert.rejects(submissionRequest("/api/submissions/stage3", options(10), "alice"));
  await submissionRequest("/api/submissions/stage3", options(25), "alice");
  assert.equal(calls[0].id, calls[1].id);
  assert.equal(calls[1].body.durationDeltaSec, 10);
  assert.equal(persisted.size, 1);
  assert.equal(storage.size, 0);
  const before = calls.length;
  await Promise.all([submissionRequest("/api/submissions/stage3", options(30), "alice"), submissionRequest("/api/submissions/stage3", options(30), "alice")]);
  assert.equal(calls.length, before + 1);
  await submissionRequest("/api/submissions/stage3", options(30), "bob");
  assert.notEqual(calls.at(-1).id, calls.at(-2).id);
  await assert.rejects(submissionRequest("/api/submissions/stage3", options(30), null));
  const malformedCalls = [];
  let malformed = true;
  globalThis.fetch = async (url, request) => {
    malformedCalls.push(request.headers["Idempotency-Key"]);
    if (malformed) { malformed = false; return new Response("<html>proxy error</html>", { status: 200 }); }
    return new Response(JSON.stringify({ success: true, submissionId: "test-submission" }), { status: 200 });
  };
  await assert.rejects(submissionRequest("/api/submissions/stage3", options(40), "charlie"));
  await submissionRequest("/api/submissions/stage3", options(40), "charlie");
  assert.equal(malformedCalls[0], malformedCalls[1]);
});
