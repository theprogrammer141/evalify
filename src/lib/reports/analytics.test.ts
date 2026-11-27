import assert from "node:assert/strict";
import test from "node:test";
import type { AttemptSnapshot } from "@/lib/attempts/types";
import {
  aggregateQuestionAnalytics,
  calculatePerformanceMetrics,
  type CandidatePerformance,
} from "@/lib/reports/analytics";

const questionIds = {
  single: "00000000-0000-4000-8000-000000000001",
  multiple: "00000000-0000-4000-8000-000000000002",
  written: "00000000-0000-4000-8000-000000000003",
};
const optionIds = {
  singleCorrect: "00000000-0000-4000-8000-000000000011",
  singleWrong: "00000000-0000-4000-8000-000000000012",
  multipleA: "00000000-0000-4000-8000-000000000021",
  multipleB: "00000000-0000-4000-8000-000000000022",
  multipleWrong: "00000000-0000-4000-8000-000000000023",
};

function makeSnapshot(): AttemptSnapshot {
  return {
    examTitle: "Assessment",
    instructions: "",
    questions: [
      {
        id: questionIds.single,
        type: "SINGLE_CHOICE",
        prompt: "Single-answer question",
        marks: 2,
        position: 0,
        options: [
          { id: optionIds.singleCorrect, text: "Correct choice" },
          { id: optionIds.singleWrong, text: "Other choice" },
        ],
        markingRules: { correctOptionId: optionIds.singleCorrect },
      },
      {
        id: questionIds.multiple,
        type: "MULTIPLE_SELECT",
        prompt: "Exact-set question",
        marks: 3,
        position: 1,
        options: [
          { id: optionIds.multipleA, text: "First choice" },
          { id: optionIds.multipleB, text: "Second choice" },
          { id: optionIds.multipleWrong, text: "Other choice" },
        ],
        markingRules: {
          correctOptionIds: [optionIds.multipleA, optionIds.multipleB],
        },
      },
      {
        id: questionIds.written,
        type: "WRITTEN",
        prompt: "Written question",
        marks: 5,
        position: 2,
        options: [],
        markingRules: {},
      },
    ],
  };
}

test("performance metrics exclude incomplete grading from final-score statistics", () => {
  const candidates: CandidatePerformance[] = [
    {
      candidateEmail: "one@example.test",
      attemptStatus: "SUBMITTED",
      completedAt: null,
      evaluationStatus: "FINALIZED",
      totalMarks: 40,
      autoMarks: 25,
      manualMarks: 15,
      maximumMarks: 50,
      published: true,
    },
    {
      candidateEmail: "two@example.test",
      attemptStatus: "EXPIRED",
      completedAt: null,
      evaluationStatus: "FINALIZED",
      totalMarks: 25,
      autoMarks: 25,
      manualMarks: 0,
      maximumMarks: 50,
      published: false,
    },
    {
      candidateEmail: "three@example.test",
      attemptStatus: "SUBMITTED",
      completedAt: null,
      evaluationStatus: "AWAITING_MANUAL",
      totalMarks: 50,
      autoMarks: 50,
      manualMarks: 0,
      maximumMarks: 50,
      published: false,
    },
  ];

  assert.deepEqual(calculatePerformanceMetrics(candidates, 4), {
    enrolledCount: 4,
    submittedCount: 3,
    participationRate: 75,
    finalizedCount: 2,
    publishedCount: 1,
    averagePercentage: 65,
    highestPercentage: 80,
    lowestPercentage: 50,
    highestMarks: 40,
    lowestMarks: 25,
    passRate: null,
    passThreshold: null,
    reportStage: "INTERNAL_REVIEW",
    scoreDistribution: [
      { label: "0–<20%", count: 0 },
      { label: "20–<40%", count: 0 },
      { label: "40–<60%", count: 1 },
      { label: "60–<80%", count: 0 },
      { label: "80–100%", count: 1 },
    ],
  });
});

test("score distribution assigns tenths at each band boundary exactly once", () => {
  const candidates = [199, 200, 999, 1000].map((totalMarks, index) => ({
    candidateEmail: `candidate-${index}@example.test`,
    attemptStatus: "SUBMITTED" as const,
    completedAt: null,
    evaluationStatus: "FINALIZED" as const,
    totalMarks,
    autoMarks: totalMarks,
    manualMarks: 0,
    maximumMarks: 1000,
    published: true,
  }));
  const metrics = calculatePerformanceMetrics(candidates, candidates.length);

  assert.deepEqual(
    metrics.scoreDistribution.map((band) => band.count),
    [1, 1, 0, 0, 2],
  );
  assert.equal(metrics.reportStage, "PUBLISHED_RESULTS");
});

test("question analytics use exact multiple-select grading and leave written correctness unset", () => {
  const snapshot = makeSnapshot();
  const results = aggregateQuestionAnalytics([
    {
      snapshot,
      answers: new Map([
        [
          questionIds.single,
          { kind: "single", optionId: optionIds.singleCorrect },
        ],
        [
          questionIds.multiple,
          { kind: "multiple", optionIds: [optionIds.multipleA] },
        ],
        [questionIds.written, { kind: "written", text: "A written response" }],
      ]),
    },
    {
      snapshot,
      answers: new Map([
        [
          questionIds.single,
          { kind: "single", optionId: optionIds.singleWrong },
        ],
        [
          questionIds.multiple,
          {
            kind: "multiple",
            optionIds: [optionIds.multipleB, optionIds.multipleA],
          },
        ],
        [questionIds.written, { kind: "written", text: "   " }],
      ]),
    },
    {
      snapshot,
      answers: new Map([
        [
          questionIds.multiple,
          { kind: "multiple", optionIds: [] },
        ],
      ]),
    },
  ]);
  const [single, multiple, written] = results;

  assert.equal(single.answeredCount, 2);
  assert.equal(single.unansweredCount, 1);
  assert.equal(single.correctCount, 1);
  assert.equal(single.correctRate, 50);
  assert.equal(
    single.options.find((option) => option.id === optionIds.singleCorrect)
      ?.selectionCount,
    1,
  );

  assert.equal(multiple.answeredCount, 2);
  assert.equal(multiple.unansweredCount, 1);
  assert.equal(multiple.correctCount, 1);
  assert.equal(multiple.correctRate, 50);
  assert.equal(
    multiple.options.find((option) => option.id === optionIds.multipleA)
      ?.selectionCount,
    2,
  );
  assert.equal(
    multiple.options.find((option) => option.id === optionIds.multipleB)
      ?.selectionCount,
    1,
  );

  assert.equal(written.answeredCount, 1);
  assert.equal(written.unansweredCount, 2);
  assert.equal(written.correctCount, null);
  assert.equal(written.correctRate, null);
});
