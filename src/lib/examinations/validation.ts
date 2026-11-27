import { z } from "zod";

const optionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
});

const questionFields = {
  prompt: z.string().trim().min(1).max(8000),
  category: z.string().trim().min(1).max(120),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  marks: z.number().int().positive().max(10000),
};

function validateObjectiveAnswers(
  question: {
    options: { id: string }[];
    answerKey: string[];
  },
  context: z.RefinementCtx,
  requireOneAnswer: boolean,
) {
  const optionIds = question.options.map((option) => option.id);
  const uniqueOptionIds = new Set(optionIds);

  if (uniqueOptionIds.size !== optionIds.length) {
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "Each answer option must have a unique ID.",
    });
  }

  if (new Set(question.answerKey).size !== question.answerKey.length) {
    context.addIssue({
      code: "custom",
      path: ["answerKey"],
      message: "A correct answer can only be selected once.",
    });
  }

  if (
    question.answerKey.some((answerId) => !uniqueOptionIds.has(answerId))
  ) {
    context.addIssue({
      code: "custom",
      path: ["answerKey"],
      message: "Every correct answer must match an available option.",
    });
  }

  if (requireOneAnswer && question.answerKey.length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["answerKey"],
      message: "Choose exactly one correct answer.",
    });
  }

  if (!requireOneAnswer && question.answerKey.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["answerKey"],
      message: "Choose at least one correct answer.",
    });
  }
}

export const singleChoiceQuestionSchema = z
  .object({
    ...questionFields,
    type: z.literal("SINGLE_CHOICE"),
    options: z.array(optionSchema).min(2).max(10),
    answerKey: z.array(z.string().uuid()).length(1),
  })
  .superRefine((question, context) =>
    validateObjectiveAnswers(question, context, true),
  );

export const multipleSelectQuestionSchema = z
  .object({
    ...questionFields,
    type: z.literal("MULTIPLE_SELECT"),
    options: z.array(optionSchema).min(2).max(10),
    answerKey: z.array(z.string().uuid()).min(1),
  })
  .superRefine((question, context) =>
    validateObjectiveAnswers(question, context, false),
  );

export const writtenResponseQuestionSchema = z.object({
  ...questionFields,
  type: z.literal("WRITTEN_RESPONSE"),
  options: z.array(optionSchema).max(0),
  answerKey: z.array(z.string().uuid()).max(0),
});

export const questionSchema = z.discriminatedUnion("type", [
  singleChoiceQuestionSchema,
  multipleSelectQuestionSchema,
  writtenResponseQuestionSchema,
]);

const examinationFields = {
  title: z.string().trim().min(1).max(180),
  instructions: z.string().trim().min(1).max(8000),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive().max(1440),
  randomizeQuestions: z.boolean(),
  randomizeOptions: z.boolean(),
};

export const examinationSchema = z
  .object(examinationFields)
  .refine(
    (examination) =>
      new Date(examination.endsAt).getTime() >
      new Date(examination.startsAt).getTime(),
    { path: ["endsAt"], message: "The end time must be after the start time." },
  );

export const examinationUpdateSchema = z
  .object(examinationFields)
  .partial()
  .refine((examination) => Object.keys(examination).length > 0, {
    message: "Provide at least one examination setting to update.",
  })
  .refine(
    (examination) =>
      !examination.startsAt ||
      !examination.endsAt ||
      new Date(examination.endsAt).getTime() >
        new Date(examination.startsAt).getTime(),
    { path: ["endsAt"], message: "The end time must be after the start time." },
  );

export const assignmentUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        marks: z.number().int().positive().max(10000),
      }),
    )
    .max(1000),
});

export const questionAssignmentSchema = z.object({
  questionId: z.string().uuid(),
  marks: z.number().int().positive().max(10000).optional(),
});

export const enrollmentSchema = z.object({
  candidateId: z.string().uuid(),
});

export type QuestionInput = z.infer<typeof questionSchema>;
export type ExaminationInput = z.infer<typeof examinationSchema>;
export type ExaminationUpdateInput = z.infer<typeof examinationUpdateSchema>;

export type PublicationRequirements = {
  title: string;
  instructions: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  questionCount: number;
  candidateCount: number;
};

export function getPublicationIssues(
  examination: PublicationRequirements,
  now: Date,
): string[] {
  const issues: string[] = [];

  if (!examination.title.trim()) issues.push("Add an examination title.");
  if (!examination.instructions.trim())
    issues.push("Add candidate instructions.");
  if (
    !Number.isInteger(examination.durationMinutes) ||
    examination.durationMinutes <= 0
  ) {
    issues.push("Set a valid examination duration.");
  }
  if (
    Number.isNaN(examination.startsAt.getTime()) ||
    Number.isNaN(examination.endsAt.getTime()) ||
    examination.endsAt <= examination.startsAt
  ) {
    issues.push("Set a valid availability window.");
  } else if (examination.endsAt <= now) {
    issues.push("The availability window must not have ended.");
  }
  if (examination.questionCount < 1)
    issues.push("Add at least one question.");
  if (examination.candidateCount < 1)
    issues.push("Enroll at least one candidate.");

  return issues;
}

export function getAvailabilityState(
  status: "DRAFT" | "PUBLISHED" | "COMPLETED",
  startsAt: Date,
  endsAt: Date,
  now: Date,
): "draft" | "upcoming" | "ongoing" | "completed" {
  if (status !== "PUBLISHED") {
    return status === "COMPLETED" ? "completed" : "draft";
  }
  if (endsAt <= now) return "completed";
  if (!isWithinAvailabilityWindow(startsAt, endsAt, now)) return "upcoming";
  return "ongoing";
}

export function isWithinAvailabilityWindow(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): boolean {
  return startsAt <= now && now < endsAt;
}