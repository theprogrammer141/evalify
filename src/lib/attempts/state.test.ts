import assert from "node:assert/strict";
import test from "node:test";
import {
  getAnswerRevisionDecision,
  getFinalizedAttemptStatus,
} from "@/lib/attempts/state";

const start = new Date("2026-01-01T10:00:00.000Z");
const deadline = new Date("2026-01-01T11:00:00.000Z");
const selectedAnswer = {
  kind: "single" as const,
  optionId: "00000000-0000-4000-8000-000000000001",
};

test("manual submission and deadline expiry converge on the deadline", () => {
  assert.equal(
    getFinalizedAttemptStatus(deadline, deadline, {
      kind: "submission",
      receivedAt: new Date(deadline.getTime() - 1),
    }),
    "SUBMITTED",
  );
  assert.equal(
    getFinalizedAttemptStatus(deadline, deadline, {
      kind: "submission",
      receivedAt: deadline,
    }),
    "EXPIRED",
  );
  assert.equal(
    getFinalizedAttemptStatus(deadline, start, { kind: "deadline" }),
    null,
  );
  assert.equal(
    getFinalizedAttemptStatus(deadline, deadline, { kind: "deadline" }),
    "EXPIRED",
  );
});

test("answer revisions reject stale writes and accept safe retries", () => {
  const unchanged = {
    storedRevision: 4,
    incomingRevision: 4,
    storedAnswer: selectedAnswer,
    incomingAnswer: selectedAnswer,
    storedMarkedForReview: true,
    incomingMarkedForReview: true,
  };
  assert.equal(getAnswerRevisionDecision(unchanged), "idempotent");
  assert.equal(
    getAnswerRevisionDecision({ ...unchanged, incomingRevision: 3 }),
    "stale",
  );
  assert.equal(
    getAnswerRevisionDecision({
      ...unchanged,
      incomingRevision: 5,
      incomingAnswer: null,
    }),
    "accept",
  );
  assert.equal(
    getAnswerRevisionDecision({
      ...unchanged,
      incomingMarkedForReview: false,
    }),
    "stale",
  );
});
