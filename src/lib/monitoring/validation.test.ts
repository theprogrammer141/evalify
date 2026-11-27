import assert from "node:assert/strict";
import test from "node:test";
import {
  announcementInputSchema,
  attemptAnswerInputSchema,
  monitoringEventInputSchema,
} from "@/lib/monitoring/validation";

test("announcement content is required and bounded", () => {
  assert.equal(announcementInputSchema.safeParse({ body: "Correction" }).success, true);
  assert.equal(announcementInputSchema.safeParse({ body: "   " }).success, false);
  assert.equal(
    announcementInputSchema.safeParse({ body: "x".repeat(2001) }).success,
    false,
  );
});

test("monitoring events accept only supported browser signals", () => {
  assert.equal(
    monitoringEventInputSchema.safeParse({
      type: "CONNECTION_INTERRUPTION",
      context: "The browser reported an offline event.",
    }).success,
    true,
  );
  assert.equal(
    monitoringEventInputSchema.safeParse({
      type: "CHEATING",
      context: "The candidate cheated.",
    }).success,
    false,
  );
});

test("answer inputs require well-formed response types", () => {
  assert.equal(
    attemptAnswerInputSchema.safeParse({
      response: { type: "options", optionIds: [] },
      markedForReview: false,
    }).success,
    true,
  );
  assert.equal(
    attemptAnswerInputSchema.safeParse({
      response: { type: "text", text: "Work shown" },
      markedForReview: true,
    }).success,
    true,
  );
  assert.equal(
    attemptAnswerInputSchema.safeParse({
      response: { type: "score", value: 100 },
      markedForReview: false,
    }).success,
    false,
  );
});
