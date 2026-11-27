import assert from "node:assert/strict";
import test from "node:test";
import {
  attemptSnapshotSchema,
  isValidAnswerForQuestion,
  isValidQuestionConfiguration,
  saveAttemptAnswerSchema,
  toCandidateQuestion,
} from "@/lib/attempts/validation";
import type { AttemptSnapshotQuestion } from "@/lib/attempts/types";

const optionA = "00000000-0000-4000-8000-000000000001";
const optionB = "00000000-0000-4000-8000-000000000002";
const questionId = "00000000-0000-4000-8000-000000000010";

const singleQuestion: AttemptSnapshotQuestion = {
  id: questionId,
  type: "SINGLE_CHOICE",
  prompt: "Which option is correct?",
  marks: 2,
  position: 0,
  options: [
    { id: optionA, text: "First" },
    { id: optionB, text: "Second" },
  ],
  markingRules: { correctOptionId: optionA, examinerNote: "private" },
};

test("validates an answer against its question type and snapshot options", () => {
  assert.equal(
    isValidAnswerForQuestion(singleQuestion, {
      kind: "single",
      optionId: optionB,
    }),
    true,
  );
  assert.equal(
    isValidAnswerForQuestion(singleQuestion, {
      kind: "multiple",
      optionIds: [optionA],
    }),
    false,
  );
  assert.equal(
    isValidAnswerForQuestion(singleQuestion, {
      kind: "single",
      optionId: "00000000-0000-4000-8000-000000000099",
    }),
    false,
  );

  const multipleQuestion = {
    ...singleQuestion,
    type: "MULTIPLE_SELECT" as const,
    markingRules: { correctOptionIds: [optionA, optionB] },
  };
  assert.equal(
    isValidAnswerForQuestion(multipleQuestion, {
      kind: "multiple",
      optionIds: [optionA, optionB],
    }),
    true,
  );

  const writtenQuestion = {
    ...singleQuestion,
    type: "WRITTEN" as const,
    options: [],
    markingRules: { rubric: "private rubric" },
  };
  assert.equal(
    isValidAnswerForQuestion(writtenQuestion, {
      kind: "written",
      text: "A candidate response",
    }),
    true,
  );
  assert.equal(
    isValidAnswerForQuestion(writtenQuestion, {
      kind: "single",
      optionId: optionA,
    }),
    false,
  );
});

test("rejects malformed, duplicate and unrecognized save input", () => {
  assert.equal(
    saveAttemptAnswerSchema.safeParse({
      revision: 1,
      answer: { kind: "single", optionId: optionA },
      markedForReview: false,
      extra: "not accepted",
    }).success,
    false,
  );
  assert.equal(
    isValidAnswerForQuestion(
      {
        ...singleQuestion,
        type: "MULTIPLE_SELECT",
        markingRules: { correctOptionIds: [optionA] },
      },
      { kind: "multiple", optionIds: [optionA, optionA] },
    ),
    false,
  );
});

test("candidate question delivery omits all marking rules", () => {
  const candidateQuestion = toCandidateQuestion(
    singleQuestion,
    { kind: "single", optionId: optionB },
    false,
    1,
  );
  const serialized = JSON.stringify(candidateQuestion);

  assert.equal("markingRules" in candidateQuestion, false);
  assert.equal(serialized.includes("correctOptionId"), false);
  assert.equal(serialized.includes("examinerNote"), false);
});

test("attempt snapshots require private marking data and valid option records", () => {
  const parsed = attemptSnapshotSchema.safeParse({
    examTitle: "Sample examination",
    instructions: "",
    questions: [singleQuestion],
  });
  assert.equal(parsed.success, true);

  assert.equal(
    attemptSnapshotSchema.safeParse({
      examTitle: "Sample examination",
      instructions: "",
      questions: [{ ...singleQuestion, options: [{ id: optionA }] }],
    }).success,
    false,
  );
});

test("objective question configurations require valid private answer keys", () => {
  assert.equal(isValidQuestionConfiguration(singleQuestion), true);
  assert.equal(
    isValidQuestionConfiguration({
      ...singleQuestion,
      markingRules: { correctOptionId: "not-an-option" },
    }),
    false,
  );
});
