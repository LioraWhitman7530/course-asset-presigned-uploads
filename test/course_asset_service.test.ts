import assert from "node:assert/strict";
import test from "node:test";
import { classifySubmission } from "../src/course_asset_service";

test("a learner submission at the exact deadline is on time", () => {
  const dueAt = "2026-09-01T16:00:00.000Z";
  assert.equal(classifySubmission(dueAt, new Date(dueAt)), "on-time");
  assert.equal(classifySubmission(dueAt, new Date("2026-09-01T16:00:00.001Z")), "late");
});
