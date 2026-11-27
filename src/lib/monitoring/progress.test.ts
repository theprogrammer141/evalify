import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttemptStatusCounts,
  getQuestionProgress,
} from "@/lib/monitoring/progress";

test("attempt totals distinguish status from not started", () => {
  assert.deepEqual(
    getAttemptStatusCounts([
      "NOT_STARTED",
      "IN_PROGRESS",
      "SUBMITTED",
      "EXPIRED",
    ]),
    {
      enrolled: 4,
      started: 3,
      submitted: 1,
      expired: 1,
      notStarted: 1,
      inProgress: 1,
    },
  );
});

test("question progress uses saved responses and review flags may overlap", () => {
  assert.deepEqual(
    getQuestionProgress(["one", "two", "three"], [
      {
        questionId: "one",
        response: { type: "options", optionIds: ["option-a"] },
        markedForReview: true,
      },
      {
        questionId: "two",
        response: { type: "text", text: "   " },
        markedForReview: false,
      },
      {
        questionId: "three",
        response: { type: "options", optionIds: [] },
        markedForReview: true,
      },
    ]),
    {
      questionCount: 3,
      answeredCount: 1,
      unansweredCount: 2,
      reviewCount: 2,
    },
  );
});
