import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoData, demoId } from "../lib/demoData.js";
import { validateOperation, submissionIdFor } from "../lib/submissionStore.js";
import Submission from "../models/Submission.js";

test("eight fixed demo records have stable ids, valid models and explicit demo markers", () => {
  const rows = buildDemoData();
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map((r) => String(r.submission._id))).size, 8);
  assert.deepEqual(rows, buildDemoData());
  for (const { submission, student } of rows) {
    assert.equal(submission.isDemo, true);
    assert.equal(student.role, "student");
    assert.equal(new Submission(submission).validateSync(), undefined);
  }
});

test("operation input rejects identity spoofing, missing retry keys and negative durations", () => {
  const body = { questionId: "Q001", code: "print(1)", language: "python" };
  assert.doesNotThrow(() => validateOperation(3, body, "operation-0001"));
  assert.throws(() => validateOperation(3, body, null), (e) => e.status === 400);
  assert.throws(() => validateOperation(3, { ...body, studentId: String(demoId("01", 1)) }, "operation-0001"), (e) => e.status === 403);
  assert.throws(() => validateOperation(3, { ...body, durationDeltaSec: -1 }, "operation-0001"), (e) => e.status === 400);
  assert.throws(() => validateOperation(3, { ...body, language: "sh" }, "operation-0001"), (e) => e.status === 400);
});

test("new submissions have stable owner/question ids without conflating different owners", () => {
  assert.equal(String(submissionIdFor(demoId("01", 1), "Q001")), String(submissionIdFor(demoId("01", 1), "Q001")));
  assert.notEqual(String(submissionIdFor(demoId("01", 1), "Q001")), String(submissionIdFor(demoId("01", 2), "Q001")));
});
