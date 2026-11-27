import assert from "node:assert/strict";
import test from "node:test";
import type { AttemptSnapshotQuestion } from "@/lib/attempts/types";
import {
  getAutomaticMarks,
  getEvaluationStatus,
  getEvaluationTotals,
  isAwardedMarkValid,
} from "@/lib/evaluations/logic";
import {
  finalizeEvaluationSchema,
  manualGradeSchema,
} from "@/lib/evaluations/validation";

const optionA = "00000000-0000-4000-8000-000000000001";
const optionB = "00000000-0000-4000-8000-000000000002";

const singleQuestion: AttemptSnapshotQuestion = {
  id: "00000000-0000-4000-8000-000000000010",
  type: "SINGLE_CHOICE",
  prompt: "Choose the correct option.",
  marks: 3,
  position: 0,
  options: [
    { id: optionA, text: "A" },
    { id: optionB, text: "B" },
  ],
  markingRules: { correctOptionId: optionA },
};

const multipleQuestion: AttemptSnapshotQuestion = {
  ...singleQuestion,
  type: "MULTIPLE_SELECT",
  markingRules: { correctOptionIds: [optionA, optionB] },
};

test("objective grading uses answer keys from the question snapshot", () => {
  assert.equal(
    getAutomaticMarks(singleQuestion, { kind: "single", optionId: optionA }),
    3,
  );
  assert.equal(
    getAutomaticMarks(singleQuestion, { kind: "single", optionId: optionB }),
    0,
  );
  assert.equal(getAutomaticMarks(singleQuestion, null), 0);
  assert.equal(
    getAutomaticMarks(multipleQuestion, {
      kind: "multiple",
      optionIds: [optionB, optionA],
    }),
    3,
  );
  assert.equal(
    getAutomaticMarks(multipleQuestion, {
      kind: "multiple",
      optionIds: [optionA],
    }),
    0,
  );
});

test("written questions remain pending for an examiner", () => {
  assert.equal(
    getAutomaticMarks(
      { ...singleQuestion, type: "WRITTEN", markingRules: { rubric: "Explain." } },
      { kind: "written", text: "" },
    ),
    null,
  );
});

test("evaluation states distinguish outstanding manual work from completion", () => {
  assert.equal(
    getEvaluationStatus([{ source: "AUTO", awardedMarks: 2 }]),
    "AUTO_GRADED",
  );
  assert.equal(
    getEvaluationStatus([{ source: "MANUAL", awardedMarks: null }]),
    "AWAITING_MANUAL",
  );
  assert.equal(
    getEvaluationStatus([
      { source: "MANUAL", awardedMarks: 2 },
      { source: "MANUAL", awardedMarks: null },
    ]),
    "PARTIALLY_EVALUATED",
  );
  assert.equal(
    getEvaluationStatus([{ source: "MANUAL", awardedMarks: 2 }]),
    "COMPLETED",
  );
});

test("evaluation totals are derived from recorded marks and reject out-of-range marks", () => {
  assert.deepEqual(
    getEvaluationTotals([
      { source: "AUTO", awardedMarks: 2 },
      { source: "MANUAL", awardedMarks: 4 },
      { source: "MANUAL", awardedMarks: null },
    ]),
    { autoMarks: 2, manualMarks: 4, totalMarks: 6 },
  );
  assert.equal(isAwardedMarkValid(0, 5), true);
  assert.equal(isAwardedMarkValid(5, 5), true);
  assert.equal(isAwardedMarkValid(-1, 5), false);
  assert.equal(isAwardedMarkValid(6, 5), false);
  assert.equal(isAwardedMarkValid(1.5, 5), false);
});

test("manual grade and finalization requests require revision-aware input", () => {
  const grade = {
    questionId: "00000000-0000-4000-8000-000000000010",
    expectedRevision: 3,
    awardedMarks: 2,
    feedback: "Clear explanation.",
  };
  assert.equal(manualGradeSchema.safeParse(grade).success, true);
  assert.equal(
    manualGradeSchema.safeParse({ ...grade, expectedRevision: -1 }).success,
    false,
  );
  assert.equal(
    manualGradeSchema.safeParse({ ...grade, awardedMarks: 1.5 }).success,
    false,
  );
  assert.equal(finalizeEvaluationSchema.safeParse({ expectedRevision: 3 }).success, true);
  assert.equal(finalizeEvaluationSchema.safeParse({}).success, false);
});
