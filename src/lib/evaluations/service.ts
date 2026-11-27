import {
  and,
  asc,
  desc,
  eq,
  inArray,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attempts,
  attemptAnswers,
  evaluationHistory,
  evaluationQuestionMarks,
  evaluations,
  examinations,
  users,
} from "@/lib/db/schema";
import { attemptSnapshotSchema } from "@/lib/attempts/validation";
import {
  getAutomaticMarks,
  getEvaluationStatus,
  getEvaluationTotals,
  isAwardedMarkValid,
} from "@/lib/evaluations/logic";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class EvaluationServiceError extends Error {
  constructor(
    readonly code:
      | "attempt_not_submitted"
      | "evaluation_incomplete"
      | "finalized"
      | "invalid_attempt_state"
      | "invalid_marks"
      | "not_found"
      | "not_finalized"
      | "question_not_manual"
      | "revision_conflict",
    readonly status: number,
  ) {
    super(code);
    this.name = "EvaluationServiceError";
  }
}

function readSnapshot(snapshot: unknown) {
  const parsed = attemptSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new EvaluationServiceError("invalid_attempt_state", 500);
  }
  return parsed.data;
}

async function createEvaluationIfNeeded(
  examinerId: string,
  attemptId: string,
): Promise<void> {
  await db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update")
      .limit(1);
    if (!attempt) throw new EvaluationServiceError("not_found", 404);

    const [access] = await transaction
      .select({ id: examinations.id })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, attempt.examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .limit(1);
    if (!access) throw new EvaluationServiceError("not_found", 404);
    if (attempt.status === "IN_PROGRESS") {
      throw new EvaluationServiceError("attempt_not_submitted", 409);
    }

    const [existing] = await transaction
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.attemptId, attemptId))
      .for("update")
      .limit(1);
    if (existing) return;

    const snapshot = readSnapshot(attempt.snapshot);
    const answers = await transaction
      .select({
        questionId: attemptAnswers.snapshotQuestionId,
        answer: attemptAnswers.answer,
      })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId));
    const answerByQuestion = new Map(
      answers.map((answer) => [answer.questionId, answer.answer]),
    );

    const initialGrades = snapshot.questions.map((question) => {
      const answer = answerByQuestion.get(question.id);
      if (answer === undefined) {
        throw new EvaluationServiceError("invalid_attempt_state", 500);
      }
      return {
        questionId: question.id,
        source: question.type === "WRITTEN" ? "MANUAL" as const : "AUTO" as const,
        awardedMarks: getAutomaticMarks(question, answer),
      };
    });
    const status = getEvaluationStatus(initialGrades);
    const totals = getEvaluationTotals(initialGrades);
    const [evaluation] = await transaction
      .insert(evaluations)
      .values({
        attemptId,
        examinerId,
        status,
        ...totals,
      })
      .returning();

    const now = new Date();
    await transaction.insert(evaluationQuestionMarks).values(
      initialGrades.map((grade) => ({
        evaluationId: evaluation.id,
        attemptId,
        questionId: grade.questionId,
        source: grade.source,
        awardedMarks: grade.awardedMarks,
        gradedAt: grade.source === "AUTO" ? now : null,
      })),
    );
    await transaction.insert(evaluationHistory).values({
      evaluationId: evaluation.id,
      attemptId,
      actorId: examinerId,
      action: "EVALUATION_CREATED",
      revision: 0,
      beforeState: null,
      afterState: {
        status,
        ...totals,
        marks: initialGrades.map(({ questionId, source, awardedMarks }) => ({
          questionId,
          source,
          awardedMarks,
        })),
      },
    });
  });
}

async function updateEvaluationTotals(
  transaction: Transaction,
  evaluationId: string,
) {
  const grades = await transaction
    .select({
      source: evaluationQuestionMarks.source,
      awardedMarks: evaluationQuestionMarks.awardedMarks,
    })
    .from(evaluationQuestionMarks)
    .where(eq(evaluationQuestionMarks.evaluationId, evaluationId));
  const totals = getEvaluationTotals(grades);
  const status = getEvaluationStatus(grades);
  return { ...totals, status };
}

export async function listExaminerEvaluations(examinerId: string) {
  const submittedAttempts = await db
    .select({
      id: attempts.id,
    })
    .from(attempts)
    .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
    .where(
      and(
        eq(examinations.examinerId, examinerId),
        inArray(attempts.status, ["SUBMITTED", "EXPIRED"]),
      ),
    )
    .orderBy(asc(attempts.finalizedAt));

  for (const attempt of submittedAttempts) {
    await createEvaluationIfNeeded(examinerId, attempt.id);
  }

  if (submittedAttempts.length === 0) return [];

  return db.transaction(async (transaction) => {
    const lockedEvaluations = await transaction
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.examinerId, examinerId))
      .for("share");
    const evaluationIds = lockedEvaluations.map((evaluation) => evaluation.id);
    if (evaluationIds.length === 0) return [];

    const rows = await transaction
      .select({
        id: evaluations.id,
        attemptId: evaluations.attemptId,
        status: evaluations.status,
        totalMarks: evaluations.totalMarks,
        autoMarks: evaluations.autoMarks,
        manualMarks: evaluations.manualMarks,
        revision: evaluations.revision,
        finalizedAt: evaluations.finalizedAt,
        publishedAt: evaluations.publishedAt,
        submittedAt: attempts.finalizedAt,
        candidateEmail: users.email,
        snapshot: attempts.snapshot,
      })
      .from(evaluations)
      .innerJoin(attempts, eq(evaluations.attemptId, attempts.id))
      .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
      .innerJoin(users, eq(attempts.candidateId, users.id))
      .where(
        and(
          inArray(evaluations.id, evaluationIds),
          eq(evaluations.examinerId, examinerId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .orderBy(desc(attempts.finalizedAt));

    const gradeRows = await transaction
      .select({
        evaluationId: evaluationQuestionMarks.evaluationId,
        source: evaluationQuestionMarks.source,
        awardedMarks: evaluationQuestionMarks.awardedMarks,
      })
      .from(evaluationQuestionMarks)
      .where(inArray(evaluationQuestionMarks.evaluationId, evaluationIds));
    const gradesByEvaluation = new Map<string, typeof gradeRows>();
    for (const grade of gradeRows) {
      const existing = gradesByEvaluation.get(grade.evaluationId) ?? [];
      existing.push(grade);
      gradesByEvaluation.set(grade.evaluationId, existing);
    }

    return rows.map((row) => {
      const snapshot = readSnapshot(row.snapshot);
      const grades = gradesByEvaluation.get(row.id) ?? [];
      return {
        id: row.id,
        attemptId: row.attemptId,
        examTitle: snapshot.examTitle,
        candidateEmail: row.candidateEmail,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        status: row.status,
        totalMarks: row.totalMarks,
        autoMarks: row.autoMarks,
        manualMarks: row.manualMarks,
        maximumMarks: snapshot.questions.reduce(
          (total, question) => total + question.marks,
          0,
        ),
        questionCount: snapshot.questions.length,
        outstandingCount: grades.filter(
          (grade) => grade.source === "MANUAL" && grade.awardedMarks === null,
        ).length,
        revision: row.revision,
        finalizedAt: row.finalizedAt?.toISOString() ?? null,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      };
    });
  });
}

export async function getExaminerEvaluation(
  examinerId: string,
  attemptId: string,
) {
  await createEvaluationIfNeeded(examinerId, attemptId);

  return db.transaction(async (transaction) => {
    const [row] = await transaction
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.attemptId, attemptId),
          eq(evaluations.examinerId, examinerId),
        ),
      )
      .for("share")
      .limit(1);
    if (!row) throw new EvaluationServiceError("not_found", 404);

    const [metadata] = await transaction
      .select({
        candidateEmail: users.email,
        attemptStatus: attempts.status,
        submittedAt: attempts.finalizedAt,
        snapshot: attempts.snapshot,
      })
      .from(attempts)
      .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
      .innerJoin(users, eq(attempts.candidateId, users.id))
      .where(
        and(
          eq(attempts.id, attemptId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .limit(1);
    if (!metadata) throw new EvaluationServiceError("not_found", 404);

    const snapshot = readSnapshot(metadata.snapshot);
    const answers = await transaction
      .select({
        questionId: attemptAnswers.snapshotQuestionId,
        answer: attemptAnswers.answer,
      })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId));
    const grades = await transaction
      .select()
      .from(evaluationQuestionMarks)
      .where(eq(evaluationQuestionMarks.evaluationId, row.id));
    const history = await transaction
      .select({
        id: evaluationHistory.id,
        questionId: evaluationHistory.questionId,
        action: evaluationHistory.action,
        revision: evaluationHistory.revision,
        beforeState: evaluationHistory.beforeState,
        afterState: evaluationHistory.afterState,
        createdAt: evaluationHistory.createdAt,
        actorEmail: users.email,
      })
      .from(evaluationHistory)
      .innerJoin(users, eq(evaluationHistory.actorId, users.id))
      .where(eq(evaluationHistory.evaluationId, row.id))
      .orderBy(desc(evaluationHistory.revision));

    const answerByQuestion = new Map(
      answers.map((answer) => [answer.questionId, answer.answer]),
    );
    const gradeByQuestion = new Map(
      grades.map((grade) => [grade.questionId, grade]),
    );
    const questions = snapshot.questions.map((question) => {
      const grade = gradeByQuestion.get(question.id);
      const answer = answerByQuestion.get(question.id);
      if (!grade || answer === undefined) {
        throw new EvaluationServiceError("invalid_attempt_state", 500);
      }
      const rubric = question.markingRules.rubric;
      return {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        marks: question.marks,
        options: question.options,
        markingGuidelines: typeof rubric === "string" ? rubric : "",
        answer,
        source: grade.source,
        awardedMarks: grade.awardedMarks,
        feedback: grade.feedback,
        revision: grade.revision,
        gradedAt: grade.gradedAt?.toISOString() ?? null,
        gradedBy: grade.gradedBy,
      };
    });
    const maximumMarks = snapshot.questions.reduce(
      (total, question) => total + question.marks,
      0,
    );
    const manualMaximumMarks = snapshot.questions.reduce(
      (total, question) =>
        question.type === "WRITTEN" ? total + question.marks : total,
      0,
    );

    return {
      id: row.id,
      attemptId: row.attemptId,
      status: row.status,
      attemptStatus: metadata.attemptStatus,
      totalMarks: row.totalMarks,
      autoMarks: row.autoMarks,
      manualMarks: row.manualMarks,
      maximumMarks,
      autoMaximumMarks: maximumMarks - manualMaximumMarks,
      manualMaximumMarks,
      revision: row.revision,
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      examTitle: snapshot.examTitle,
      instructions: snapshot.instructions,
      candidateEmail: metadata.candidateEmail,
      submittedAt: metadata.submittedAt?.toISOString() ?? null,
      questions,
      history: history.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  });
}

export async function updateManualGrade(input: {
  examinerId: string;
  attemptId: string;
  questionId: string;
  expectedRevision: number;
  awardedMarks: number;
  feedback: string;
}) {
  await createEvaluationIfNeeded(input.examinerId, input.attemptId);
  await db.transaction(async (transaction) => {
    const [evaluation] = await transaction
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.attemptId, input.attemptId),
          eq(evaluations.examinerId, input.examinerId),
        ),
      )
      .for("update")
      .limit(1);
    if (!evaluation) throw new EvaluationServiceError("not_found", 404);
    if (evaluation.status === "FINALIZED") {
      throw new EvaluationServiceError("finalized", 409);
    }

    const [attempt] = await transaction
      .select({ snapshot: attempts.snapshot })
      .from(attempts)
      .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
      .where(
        and(
          eq(attempts.id, input.attemptId),
          eq(examinations.examinerId, input.examinerId),
        ),
      )
      .limit(1);
    if (!attempt) throw new EvaluationServiceError("not_found", 404);
    const snapshot = readSnapshot(attempt.snapshot);
    const question = snapshot.questions.find(
      (item) => item.id === input.questionId,
    );
    if (!question) throw new EvaluationServiceError("not_found", 404);
    if (question.type !== "WRITTEN") {
      throw new EvaluationServiceError("question_not_manual", 409);
    }
    if (!isAwardedMarkValid(input.awardedMarks, question.marks)) {
      throw new EvaluationServiceError("invalid_marks", 400);
    }

    const [grade] = await transaction
      .select()
      .from(evaluationQuestionMarks)
      .where(
        and(
          eq(evaluationQuestionMarks.evaluationId, evaluation.id),
          eq(evaluationQuestionMarks.questionId, input.questionId),
        ),
      )
      .for("update")
      .limit(1);
    if (!grade || grade.source !== "MANUAL") {
      throw new EvaluationServiceError("invalid_attempt_state", 500);
    }

    const feedback = input.feedback.trim();
    if (input.expectedRevision !== evaluation.revision) {
      if (
        grade.awardedMarks === input.awardedMarks &&
        grade.feedback === feedback
      ) {
        return;
      }
      throw new EvaluationServiceError("revision_conflict", 409);
    }
    if (
      grade.awardedMarks === input.awardedMarks &&
      grade.feedback === feedback
    ) {
      return;
    }

    const now = new Date();
    const [updatedGrade] = await transaction
      .update(evaluationQuestionMarks)
      .set({
        awardedMarks: input.awardedMarks,
        feedback,
        gradedBy: input.examinerId,
        gradedAt: now,
        revision: grade.revision + 1,
        updatedAt: now,
      })
      .where(eq(evaluationQuestionMarks.id, grade.id))
      .returning();
    const totals = await updateEvaluationTotals(transaction, evaluation.id);
    const updatedRevision = evaluation.revision + 1;
    await transaction
      .update(evaluations)
      .set({ ...totals, revision: updatedRevision, updatedAt: now })
      .where(eq(evaluations.id, evaluation.id));
    await transaction.insert(evaluationHistory).values({
      evaluationId: evaluation.id,
      attemptId: input.attemptId,
      actorId: input.examinerId,
      questionId: input.questionId,
      action: "MARKS_UPDATED",
      revision: updatedRevision,
      beforeState: {
        awardedMarks: grade.awardedMarks,
        feedback: grade.feedback,
        status: evaluation.status,
        totalMarks: evaluation.totalMarks,
        autoMarks: evaluation.autoMarks,
        manualMarks: evaluation.manualMarks,
        revision: evaluation.revision,
      },
      afterState: {
        awardedMarks: updatedGrade.awardedMarks,
        feedback: updatedGrade.feedback,
        status: totals.status,
        totalMarks: totals.totalMarks,
        autoMarks: totals.autoMarks,
        manualMarks: totals.manualMarks,
        revision: updatedRevision,
      },
    });
  });

  return getExaminerEvaluation(input.examinerId, input.attemptId);
}

export async function finalizeEvaluation(input: {
  examinerId: string;
  attemptId: string;
  expectedRevision: number;
}) {
  await createEvaluationIfNeeded(input.examinerId, input.attemptId);
  await db.transaction(async (transaction) => {
    const [evaluation] = await transaction
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.attemptId, input.attemptId),
          eq(evaluations.examinerId, input.examinerId),
        ),
      )
      .for("update")
      .limit(1);
    if (!evaluation) throw new EvaluationServiceError("not_found", 404);
    if (evaluation.status === "FINALIZED") return;
    if (evaluation.revision !== input.expectedRevision) {
      throw new EvaluationServiceError("revision_conflict", 409);
    }
    if (
      evaluation.status === "AWAITING_MANUAL" ||
      evaluation.status === "PARTIALLY_EVALUATED"
    ) {
      throw new EvaluationServiceError("evaluation_incomplete", 409);
    }

    const [access] = await transaction
      .select({ id: examinations.id })
      .from(attempts)
      .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
      .where(
        and(
          eq(attempts.id, input.attemptId),
          eq(examinations.examinerId, input.examinerId),
        ),
      )
      .limit(1);
    if (!access) throw new EvaluationServiceError("not_found", 404);

    const now = new Date();
    const revision = evaluation.revision + 1;
    await transaction
      .update(evaluations)
      .set({
        status: "FINALIZED",
        finalizedBy: input.examinerId,
        finalizedAt: now,
        revision,
        updatedAt: now,
      })
      .where(eq(evaluations.id, evaluation.id));
    await transaction.insert(evaluationHistory).values({
      evaluationId: evaluation.id,
      attemptId: input.attemptId,
      actorId: input.examinerId,
      action: "FINALIZED",
      revision,
      beforeState: {
        status: evaluation.status,
        totalMarks: evaluation.totalMarks,
        autoMarks: evaluation.autoMarks,
        manualMarks: evaluation.manualMarks,
        revision: evaluation.revision,
      },
      afterState: {
        status: "FINALIZED",
        totalMarks: evaluation.totalMarks,
        autoMarks: evaluation.autoMarks,
        manualMarks: evaluation.manualMarks,
        revision,
        finalizedAt: now.toISOString(),
      },
    });
  });

  return getExaminerEvaluation(input.examinerId, input.attemptId);
}

export async function publishEvaluation(input: {
  examinerId: string;
  attemptId: string;
}) {
  await db.transaction(async (transaction) => {
    const [evaluation] = await transaction
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.attemptId, input.attemptId),
          eq(evaluations.examinerId, input.examinerId),
        ),
      )
      .for("update")
      .limit(1);
    if (!evaluation) throw new EvaluationServiceError("not_found", 404);
    if (evaluation.publishedAt) return;
    if (evaluation.status !== "FINALIZED") {
      throw new EvaluationServiceError("not_finalized", 409);
    }

    const [access] = await transaction
      .select({ id: examinations.id })
      .from(attempts)
      .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
      .where(
        and(
          eq(attempts.id, input.attemptId),
          eq(examinations.examinerId, input.examinerId),
        ),
      )
      .limit(1);
    if (!access) throw new EvaluationServiceError("not_found", 404);

    await transaction
      .update(evaluations)
      .set({
        publishedBy: input.examinerId,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(evaluations.id, evaluation.id));
  });

  return getExaminerEvaluation(input.examinerId, input.attemptId);
}
