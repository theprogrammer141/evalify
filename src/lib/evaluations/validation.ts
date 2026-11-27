import { z } from "zod";

export const manualGradeSchema = z
  .object({
    questionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    awardedMarks: z.number().int().min(0).max(10_000),
    feedback: z.string().max(8000),
  })
  .strict();

export const finalizeEvaluationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
