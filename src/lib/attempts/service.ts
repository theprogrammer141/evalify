import { randomInt } from "node:crypto";
import {
  and,
  asc,
  eq,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attemptAnswers,
  attempts,
  enrollments,
  examinationQuestions,
  examinations,
  questions,
  users,
} from "@/lib/db/schema";
import type { DbQuestionType } from "@/lib/db/schema";
import {
  attemptSnapshotSchema,
  isValidAnswerForQuestion,
  isValidQuestionConfiguration,
  toCandidateQuestion,
} from "@/lib/attempts/validation";
import type {
  AttemptAnswerValue,
  AttemptSnapshot,
  AttemptSnapshotQuestion,
  CandidateAttempt,
  CandidateQuestion,
  QuestionOption,
} from "@/lib/attempts/types";

export class AttemptServiceError extends Error {
  constructor(
    readonly code:
      | "attempt_finalized"
      | "exam_not_available"
      | "exam_not_found"
      | "invalid_exam_configuration"
      | "invalid_attempt_state"
      | "not_enrolled"
      | "not_found"
      | "question_not_in_attempt"
      | "revision_conflict"
      | "invalid_answer",
    readonly status: number,
  ) {
    super(code);
    this.name = "AttemptServiceError";
  }
}

type AnswerRow = {
  snapshotQuestionId: string;
  answer: AttemptAnswerValue | null;
  markedForReview: boolean;
  revision: number;
};

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

async function getDatabaseNow(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  candidateId: string,
): Promise<Date> {
  const [row] = await transaction
    .select({
      now: sql<Date>`clock_timestamp()`.mapWith(examinations.opensAt),
    })
    .from(users)
    .where(eq(users.id, candidateId))
    .limit(1);
  return row.now;
}

function parseSnapshot(snapshot: unknown): AttemptSnapshot {
  const parsed = attemptSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new AttemptServiceError("invalid_attempt_state", 500);
  }
  return parsed.data;
}

function stateMatches(
  stored: AnswerRow,
  answer: AttemptAnswerValue | null,
  markedForReview: boolean,
): boolean {
  return (
    JSON.stringify(stored.answer) === JSON.stringify(answer) &&
    stored.markedForReview === markedForReview
  );
}

function toCandidateAttempt(
  attempt: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
    startedAt: Date;
    expiresAt: Date;
    finalizedAt: Date | null;
    snapshot: unknown;
  },
  answers: AnswerRow[],
  serverNow: Date,
): CandidateAttempt {
  const snapshot = parseSnapshot(attempt.snapshot);
  const answersByQuestion = new Map(
    answers.map((answer) => [answer.snapshotQuestionId, answer]),
  );
  const candidateQuestions: CandidateQuestion[] = snapshot.questions.map(
    (question) => {
      const answer = answersByQuestion.get(question.id);
      if (!answer) {
        throw new AttemptServiceError("invalid_attempt_state", 500);
      }
      return toCandidateQuestion(
        question,
        answer.answer,
        answer.markedForReview,
        answer.revision,
      );
    },
  );

  return {
    id: attempt.id,
    status: attempt.status,
    examTitle: snapshot.examTitle,
    instructions: snapshot.instructions,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    finalizedAt: attempt.finalizedAt?.toISOString() ?? null,
    serverNow: serverNow.toISOString(),
    questions: candidateQuestions,
  };
}

async function finalizeAttemptInTransaction(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  attempt: typeof attempts.$inferSelect,
  now: Date,
  request:
    | { kind: "deadline"; receivedAt?: Date }
    | { kind: "submission"; receivedAt: Date },
): Promise<typeof attempts.$inferSelect> {
  if (attempt.status !== "IN_PROGRESS") return attempt;

  const shouldExpire =
    request.kind === "deadline"
      ? attempt.expiresAt <= now ||
        (request.receivedAt !== undefined &&
          request.receivedAt >= attempt.expiresAt)
      : request.receivedAt >= attempt.expiresAt;
  if (request.kind === "deadline" && !shouldExpire) return attempt;

  const [finalized] = await transaction
    .update(attempts)
    .set({
      status: shouldExpire ? "EXPIRED" : "SUBMITTED",
      finalizedAt: now,
    })
    .where(
      request.kind === "submission"
        ? and(
            eq(attempts.id, attempt.id),
            eq(attempts.status, "IN_PROGRESS"),
          )
        : and(
            eq(attempts.id, attempt.id),
            eq(attempts.status, "IN_PROGRESS"),
            request.receivedAt
              ? or(
                  lte(attempts.expiresAt, now),
                  lte(attempts.expiresAt, request.receivedAt),
                )
              : lte(attempts.expiresAt, now),
          ),
    )
    .returning();
  return finalized ?? attempt;
}

async function getAnswers(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  attemptId: string,
): Promise<AnswerRow[]> {
  return transaction
    .select({
      snapshotQuestionId: attemptAnswers.snapshotQuestionId,
      answer: attemptAnswers.answer,
      markedForReview: attemptAnswers.markedForReview,
      revision: attemptAnswers.revision,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
}

function makeSnapshotQuestion(input: {
  id: string;
  type: DbQuestionType;
  prompt: string;
  marks: number;
  position: number;
  options: QuestionOption[];
  markingRules: Record<string, unknown>;
}): AttemptSnapshotQuestion {
  return {
    ...input,
    type: input.type === "WRITTEN_RESPONSE" ? "WRITTEN" : input.type,
  };
}

export async function listCandidateExaminations(candidateId: string) {
  const expiredAttempts = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.candidateId, candidateId),
        eq(attempts.status, "IN_PROGRESS"),
        lte(attempts.expiresAt, sql`clock_timestamp()`),
      ),
    );
  for (const expiredAttempt of expiredAttempts) {
    await getCandidateAttempt(candidateId, expiredAttempt.id);
  }

  const [serverNow] = await db
    .select({
      now: sql<Date>`clock_timestamp()`.mapWith(examinations.opensAt),
    })
    .from(users)
    .where(eq(users.id, candidateId))
    .limit(1);
  const rows = await db
    .select({
      id: examinations.id,
      title: examinations.title,
      instructions: examinations.instructions,
      opensAt: examinations.opensAt,
      closesAt: examinations.closesAt,
      durationMinutes: examinations.durationMinutes,
      status: examinations.status,
      attemptId: attempts.id,
      attemptStatus: attempts.status,
    })
    .from(enrollments)
    .innerJoin(
      examinations,
      eq(enrollments.examinationId, examinations.id),
    )
    .leftJoin(
      attempts,
      and(
        eq(attempts.examinationId, examinations.id),
        eq(attempts.candidateId, candidateId),
      ),
    )
    .where(
      and(
        eq(enrollments.candidateId, candidateId),
        eq(enrollments.status, "ENROLLED"),
      ),
    )
    .orderBy(asc(examinations.opensAt));

  return {
    serverNow: serverNow.now.toISOString(),
    examinations: rows.map((row) => ({
      ...row,
      opensAt: row.opensAt.toISOString(),
      closesAt: row.closesAt.toISOString(),
      availability: getAvailability(row, serverNow.now),
    })),
  };
}

function getAvailability(
  examination: { status: "DRAFT" | "PUBLISHED" | "COMPLETED"; opensAt: Date; closesAt: Date },
  now: Date,
): "UNAVAILABLE" | "UPCOMING" | "CLOSED" | "AVAILABLE" {
  if (examination.status !== "PUBLISHED") return "UNAVAILABLE";
  if (now < examination.opensAt) return "UPCOMING";
  if (now >= examination.closesAt) return "CLOSED";
  return "AVAILABLE";
}

export async function startCandidateAttempt(
  candidateId: string,
  examinationId: string,
): Promise<CandidateAttempt> {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select()
      .from(examinations)
      .where(eq(examinations.id, examinationId))
      .for("update")
      .limit(1);
    if (!examination) {
      throw new AttemptServiceError("exam_not_found", 404);
    }

    const [existingAttempt] = await transaction
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.examinationId, examinationId),
          eq(attempts.candidateId, candidateId),
        ),
      )
      .for("update")
      .limit(1);

    const now = await getDatabaseNow(transaction, candidateId);
    if (existingAttempt) {
      const currentAttempt = await finalizeAttemptInTransaction(
        transaction,
        existingAttempt,
        now,
        { kind: "deadline" },
      );
      return toCandidateAttempt(
        currentAttempt,
        await getAnswers(transaction, currentAttempt.id),
        now,
      );
    }

    const [enrollment] = await transaction
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.examinationId, examinationId),
          eq(enrollments.candidateId, candidateId),
          eq(enrollments.status, "ENROLLED"),
        ),
      )
      .limit(1);
    if (!enrollment) {
      throw new AttemptServiceError("not_enrolled", 403);
    }

    if (
      examination.status !== "PUBLISHED" ||
      examination.opensAt > now ||
      examination.closesAt <= now
    ) {
      throw new AttemptServiceError("exam_not_available", 409);
    }

    const assignedRefs = await transaction
      .select({ questionId: examinationQuestions.questionId })
      .from(examinationQuestions)
      .where(eq(examinationQuestions.examinationId, examinationId))
      .for("share");
    if (
      assignedRefs.length === 0 ||
      assignedRefs.some(({ questionId }) => questionId === null)
    ) {
      throw new AttemptServiceError("invalid_exam_configuration", 409);
    }

    const assignedQuestions = await transaction
      .select({
        id: questions.id,
        type: questions.type,
        prompt: questions.prompt,
        options: questions.options,
        markingRules: questions.markingRules,
        marks: examinationQuestions.marks,
        position: examinationQuestions.position,
      })
      .from(examinationQuestions)
      .innerJoin(questions, eq(examinationQuestions.questionId, questions.id))
      .where(
        and(
          eq(examinationQuestions.examinationId, examinationId),
          eq(questions.examinerId, examination.examinerId),
        ),
      )
      .orderBy(asc(examinationQuestions.position))
      .for("share");

    if (assignedQuestions.length !== assignedRefs.length) {
      throw new AttemptServiceError("invalid_exam_configuration", 409);
    }

    let snapshotQuestions = assignedQuestions.map((question) =>
      makeSnapshotQuestion({
        ...question,
        options: question.options,
      }),
    );
    snapshotQuestions = snapshotQuestions.map((question) => {
      if (!isValidQuestionConfiguration(question)) {
        throw new AttemptServiceError("invalid_exam_configuration", 409);
      }
      return question;
    });

    if (examination.randomizeQuestions) {
      snapshotQuestions = shuffle(snapshotQuestions);
    }
    snapshotQuestions = snapshotQuestions.map((question, index) => {
      const options = examination.randomizeOptions
        ? shuffle(question.options)
        : question.options;
      return { ...question, options, position: index };
    });

    const snapshot: AttemptSnapshot = {
      examTitle: examination.title,
      instructions: examination.instructions,
      questions: snapshotQuestions,
    };
    const validatedSnapshot = attemptSnapshotSchema.safeParse(snapshot);
    if (!validatedSnapshot.success) {
      throw new AttemptServiceError("invalid_exam_configuration", 409);
    }

    const expiresAt = new Date(
      now.getTime() + examination.durationMinutes * 60_000,
    );
    const [createdAttempt] = await transaction
      .insert(attempts)
      .values({
        examinationId,
        candidateId,
        status: "IN_PROGRESS",
        startedAt: now,
        expiresAt,
        snapshot: validatedSnapshot.data,
      })
      .returning();

    await transaction.insert(attemptAnswers).values(
      snapshotQuestions.map((question) => ({
        attemptId: createdAttempt.id,
        snapshotQuestionId: question.id,
        answer: null,
        markedForReview: false,
        revision: 0,
      })),
    );

    return toCandidateAttempt(
      createdAttempt,
      await getAnswers(transaction, createdAttempt.id),
      now,
    );
  });
}

export async function getCandidateAttempt(
  candidateId: string,
  attemptId: string,
): Promise<CandidateAttempt> {
  return db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.id, attemptId),
          eq(attempts.candidateId, candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt) throw new AttemptServiceError("not_found", 404);

    const now = await getDatabaseNow(transaction, candidateId);
    const currentAttempt = await finalizeAttemptInTransaction(
      transaction,
      attempt,
      now,
      { kind: "deadline" },
    );
    return toCandidateAttempt(
      currentAttempt,
      await getAnswers(transaction, currentAttempt.id),
      now,
    );
  });
}

export async function saveCandidateAnswer(input: {
  candidateId: string;
  attemptId: string;
  questionId: string;
  revision: number;
  answer: AttemptAnswerValue | null;
  markedForReview: boolean;
  receivedAt: Date;
}): Promise<{
  questionId: string;
  answer: AttemptAnswerValue | null;
  markedForReview: boolean;
  revision: number;
}> {
  const result = await db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.id, input.attemptId),
          eq(attempts.candidateId, input.candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt) throw new AttemptServiceError("not_found", 404);

    const [nowRow] = await transaction
      .select({
        now: sql<Date>`clock_timestamp()`.mapWith(examinations.opensAt),
      })
      .from(users)
      .where(eq(users.id, input.candidateId))
      .limit(1);
    const now = nowRow.now;
    const currentAttempt = await finalizeAttemptInTransaction(
      transaction,
      attempt,
      now,
      { kind: "deadline", receivedAt: input.receivedAt },
    );
    if (
      currentAttempt.status !== "IN_PROGRESS" ||
      input.receivedAt >= currentAttempt.expiresAt
    ) {
      return { error: "attempt_finalized" as const };
    }

    const snapshot = parseSnapshot(currentAttempt.snapshot);
    const question = snapshot.questions.find(
      (item) => item.id === input.questionId,
    );
    if (!question) {
      throw new AttemptServiceError("question_not_in_attempt", 404);
    }
    if (!isValidAnswerForQuestion(question, input.answer)) {
      throw new AttemptServiceError("invalid_answer", 400);
    }

    const [storedAnswer] = await transaction
      .select()
      .from(attemptAnswers)
      .where(
        and(
          eq(attemptAnswers.attemptId, input.attemptId),
          eq(attemptAnswers.snapshotQuestionId, input.questionId),
        ),
      )
      .for("update")
      .limit(1);
    if (!storedAnswer) {
      throw new AttemptServiceError("invalid_attempt_state", 500);
    }

    if (input.revision < storedAnswer.revision) {
      throw new AttemptServiceError("revision_conflict", 409);
    }
    if (input.revision === storedAnswer.revision) {
      if (
        !stateMatches(
          storedAnswer,
          input.answer,
          input.markedForReview,
        )
      ) {
        return { error: "revision_conflict" as const };
      }
      return {
        error: null,
        questionId: storedAnswer.snapshotQuestionId,
        answer: storedAnswer.answer,
        markedForReview: storedAnswer.markedForReview,
        revision: storedAnswer.revision,
      };
    }

    const [saved] = await transaction
      .update(attemptAnswers)
      .set({
        answer: input.answer,
        markedForReview: input.markedForReview,
        revision: input.revision,
        updatedAt: now,
      })
      .where(
        and(
          eq(attemptAnswers.id, storedAnswer.id),
          lte(attemptAnswers.revision, input.revision - 1),
        ),
      )
      .returning();

    if (!saved) return { error: "revision_conflict" as const };
    return {
      error: null,
      questionId: saved.snapshotQuestionId,
      answer: saved.answer,
      markedForReview: saved.markedForReview,
      revision: saved.revision,
    };
  });

  if (result.error) {
    throw new AttemptServiceError(result.error, 409);
  }
  return {
    questionId: result.questionId,
    answer: result.answer,
    markedForReview: result.markedForReview,
    revision: result.revision,
  };
}

export async function finalizeCandidateAttempt(input: {
  candidateId: string;
  attemptId: string;
  receivedAt: Date;
}): Promise<CandidateAttempt> {
  return db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.id, input.attemptId),
          eq(attempts.candidateId, input.candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt) throw new AttemptServiceError("not_found", 404);

    const now = await getDatabaseNow(transaction, input.candidateId);
    const currentAttempt = await finalizeAttemptInTransaction(
      transaction,
      attempt,
      now,
      { kind: "submission", receivedAt: input.receivedAt },
    );

    return toCandidateAttempt(
      currentAttempt,
      await getAnswers(transaction, currentAttempt.id),
      now,
    );
  });
}

export async function finalizeDueAttempts(): Promise<number> {
  const dueAttempts = await db
    .select({ id: attempts.id, candidateId: attempts.candidateId })
    .from(attempts)
    .where(
      and(
        eq(attempts.status, "IN_PROGRESS"),
        lte(attempts.expiresAt, sql`clock_timestamp()`),
      ),
    );

  let finalizedCount = 0;
  for (const dueAttempt of dueAttempts) {
    const finalized = await db.transaction(async (transaction) => {
      const [attempt] = await transaction
        .select()
        .from(attempts)
        .where(eq(attempts.id, dueAttempt.id))
        .for("update")
        .limit(1);
      if (!attempt) return false;

      const now = await getDatabaseNow(transaction, dueAttempt.candidateId);
      const result = await finalizeAttemptInTransaction(
        transaction,
        attempt,
        now,
        { kind: "deadline" },
      );
      return attempt.status === "IN_PROGRESS" && result.status === "EXPIRED";
    });
    if (finalized) finalizedCount += 1;
  }

  return finalizedCount;
}

export async function getExaminerAttempt(
  examinerId: string,
  attemptId: string,
) {
  return db.transaction(async (transaction) => {
    const [lockedAttempt] = await transaction
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update")
      .limit(1);
    if (!lockedAttempt) throw new AttemptServiceError("not_found", 404);

    const [metadata] = await transaction
      .select({
        candidateEmail: users.email,
        examTitle: examinations.title,
      })
      .from(attempts)
      .innerJoin(
        examinations,
        eq(attempts.examinationId, examinations.id),
      )
      .innerJoin(users, eq(attempts.candidateId, users.id))
      .where(
        and(
          eq(attempts.id, attemptId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .limit(1);
    if (!metadata) throw new AttemptServiceError("not_found", 404);

    const now = await getDatabaseNow(transaction, lockedAttempt.candidateId);
    const current = await finalizeAttemptInTransaction(
      transaction,
      lockedAttempt,
      now,
      { kind: "deadline" },
    );
    const answers = await getAnswers(transaction, attemptId);

    return {
      id: current.id,
      candidateId: current.candidateId,
      candidateEmail: metadata.candidateEmail,
      status: current.status,
      startedAt: current.startedAt.toISOString(),
      expiresAt: current.expiresAt.toISOString(),
      finalizedAt: current.finalizedAt?.toISOString() ?? null,
      examTitle: metadata.examTitle,
      questions: toCandidateAttempt(current, answers, now).questions,
    };
  });
}
