import { z } from "zod";
import type {
  AttemptAnswerValue,
  AttemptSnapshotQuestion,
  CandidateQuestion,
} from "@/lib/attempts/types";

const optionSchema = z.object({
  id: z.uuid(),
  text: z.string().min(1).max(4000),
}).strict();

export const attemptSnapshotQuestionSchema = z.object({
  id: z.uuid(),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_SELECT", "WRITTEN"]),
  prompt: z.string().min(1).max(20_000),
  marks: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  options: z.array(optionSchema),
  markingRules: z.record(z.string(), z.unknown()),
}).strict();

export const attemptSnapshotSchema = z.object({
  examTitle: z.string().min(1).max(240),
  instructions: z.string().max(20_000),
  questions: z.array(attemptSnapshotQuestionSchema).min(1),
}).strict();

const answerValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("single"), optionId: z.uuid() }).strict(),
  z.object({
    kind: z.literal("multiple"),
    optionIds: z.array(z.uuid()),
  }).strict(),
  z.object({ kind: z.literal("written"), text: z.string().max(100_000) }).strict(),
]);

export const saveAttemptAnswerSchema = z.object({
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  answer: answerValueSchema.nullable(),
  markedForReview: z.boolean(),
}).strict();

export function isValidAnswerForQuestion(
  question: AttemptSnapshotQuestion,
  answer: AttemptAnswerValue | null,
): boolean {
  if (answer === null) return true;

  const optionIds = new Set(question.options.map((option) => option.id));
  switch (question.type) {
    case "SINGLE_CHOICE":
      return (
        answer.kind === "single" &&
        optionIds.has(answer.optionId)
      );
    case "MULTIPLE_SELECT":
      return (
        answer.kind === "multiple" &&
        new Set(answer.optionIds).size === answer.optionIds.length &&
        answer.optionIds.every((optionId) => optionIds.has(optionId))
      );
    case "WRITTEN":
      return answer.kind === "written";
  }
}

export function isValidQuestionConfiguration(
  question: AttemptSnapshotQuestion,
): boolean {
  const optionIds = question.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) return false;

  switch (question.type) {
    case "SINGLE_CHOICE": {
      const correctOptionId = question.markingRules.correctOptionId;
      return (
        question.options.length >= 2 &&
        typeof correctOptionId === "string" &&
        optionIds.includes(correctOptionId)
      );
    }
    case "MULTIPLE_SELECT": {
      const correctOptionIds = question.markingRules.correctOptionIds;
      return (
        question.options.length >= 2 &&
        Array.isArray(correctOptionIds) &&
        correctOptionIds.length > 0 &&
        correctOptionIds.every(
          (id) => typeof id === "string" && optionIds.includes(id),
        ) &&
        new Set(correctOptionIds).size === correctOptionIds.length
      );
    }
    case "WRITTEN":
      return question.options.length === 0;
  }
}

export function toCandidateQuestion(
  question: AttemptSnapshotQuestion,
  answer: AttemptAnswerValue | null,
  markedForReview: boolean,
  revision: number,
): CandidateQuestion {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    marks: question.marks,
    position: question.position,
    options: question.options,
    answer,
    markedForReview,
    revision,
  };
}
