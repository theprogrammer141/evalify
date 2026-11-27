import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  examinationEnrollments,
  examinationQuestions,
  examinations,
  questions,
  users,
} from "@/lib/db/schema";
import {
  examinationSchema,
  getAvailabilityState,
  getPublicationIssues,
  isWithinAvailabilityWindow,
  type ExaminationInput,
  type ExaminationUpdateInput,
  type QuestionInput,
} from "@/lib/examinations/validation";

type AvailabilityState = ReturnType<typeof getAvailabilityState>;

function toBankQuestion<T extends {
  type: typeof questions.$inferSelect.type;
  markingRules: typeof questions.$inferSelect.markingRules;
}>(question: T) {
  const answerKey =
    question.type === "SINGLE_CHOICE" &&
    typeof question.markingRules.correctOptionId === "string"
      ? [question.markingRules.correctOptionId]
      : question.type === "MULTIPLE_SELECT" &&
          Array.isArray(question.markingRules.correctOptionIds)
        ? question.markingRules.correctOptionIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [];

  return {
    ...question,
    type: question.type === "WRITTEN" ? "WRITTEN_RESPONSE" : question.type,
    answerKey,
  };
}

function questionInputValues(input: QuestionInput) {
  const { answerKey, ...question } = input;
  const markingRules =
    input.type === "SINGLE_CHOICE"
      ? { correctOptionId: answerKey[0] }
      : input.type === "MULTIPLE_SELECT"
        ? { correctOptionIds: answerKey }
        : {};
  return { ...question, markingRules };
}

function examinationState(
  examination: typeof examinations.$inferSelect,
  now: Date,
): AvailabilityState {
  if (examination.status === "COMPLETED") return "completed";
  return getAvailabilityState(
    examination.status,
    examination.opensAt,
    examination.closesAt,
    now,
  );
}

function publishedAvailability(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): Exclude<AvailabilityState, "draft"> {
  if (endsAt <= now) return "completed";
  if (!isWithinAvailabilityWindow(startsAt, endsAt, now)) return "upcoming";
  return "ongoing";
}

export async function listExaminations(examinerId: string) {
  const rows = await db
    .select()
    .from(examinations)
    .where(eq(examinations.examinerId, examinerId))
    .orderBy(desc(examinations.updatedAt), asc(examinations.title));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [assignedQuestions, enrollments] = await Promise.all([
    db
      .select({
        examinationId: examinationQuestions.examinationId,
        id: examinationQuestions.id,
      })
      .from(examinationQuestions)
      .where(inArray(examinationQuestions.examinationId, ids)),
    db
      .select({ examinationId: examinationEnrollments.examinationId })
      .from(examinationEnrollments)
      .where(inArray(examinationEnrollments.examinationId, ids)),
  ]);
  const now = new Date();

  return rows.map((row) => {
    const examQuestions = assignedQuestions.filter(
      (item) => item.examinationId === row.id,
    );
    return {
      ...row,
      startsAt: row.opensAt,
      endsAt: row.closesAt,
      availability: examinationState(row, now),
      questionCount: examQuestions.length,
      candidateCount: enrollments.filter(
        (item) => item.examinationId === row.id,
      ).length,
      totalMarks: row.totalMarks,
    };
  });
}

export async function getExaminerExamination(
  examinerId: string,
  examinationId: string,
) {
  const [examination] = await db
    .select()
    .from(examinations)
    .where(
      and(
        eq(examinations.id, examinationId),
        eq(examinations.examinerId, examinerId),
      ),
    )
    .limit(1);

  if (!examination) return null;

  const [assignedQuestions, enrolledCandidates] = await Promise.all([
    db
      .select({
        id: examinationQuestions.id,
        sourceQuestionId: examinationQuestions.questionId,
        position: examinationQuestions.position,
        marks: examinationQuestions.marks,
        prompt: questions.prompt,
        category: questions.category,
        difficulty: questions.difficulty,
        type: questions.type,
        options: questions.options,
        markingRules: questions.markingRules,
        examinerId: questions.examinerId,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
      })
      .from(examinationQuestions)
      .innerJoin(
        questions,
        eq(examinationQuestions.questionId, questions.id),
      )
      .where(eq(examinationQuestions.examinationId, examinationId))
      .orderBy(asc(examinationQuestions.position)),
    db
      .select({
        id: users.id,
        email: users.email,
        enrolledAt: examinationEnrollments.enrolledAt,
      })
      .from(examinationEnrollments)
      .innerJoin(users, eq(examinationEnrollments.candidateId, users.id))
      .where(eq(examinationEnrollments.examinationId, examinationId))
      .orderBy(asc(users.email)),
  ]);
  const now = new Date();

  return {
    ...examination,
    availability: examinationState(examination, now),
    startsAt: examination.opensAt,
    endsAt: examination.closesAt,
    questions: assignedQuestions.map((question) => ({
      ...toBankQuestion(question),
      id: question.id,
      sourceQuestionId: question.sourceQuestionId,
      position: question.position,
      marks: question.marks,
    })),
    candidates: enrolledCandidates,
    questionCount: assignedQuestions.length,
    candidateCount: enrolledCandidates.length,
    totalMarks: examination.totalMarks,
  };
}

export async function createExamination(
  examinerId: string,
  input: ExaminationInput,
) {
  const [created] = await db
    .insert(examinations)
    .values({
      examinerId,
      title: input.title,
      instructions: input.instructions,
      opensAt: new Date(input.startsAt),
      closesAt: new Date(input.endsAt),
      durationMinutes: input.durationMinutes,
      randomizeQuestions: input.randomizeQuestions,
      randomizeOptions: input.randomizeOptions,
    })
    .returning();

  return created;
}

export async function updateExamination(
  examinerId: string,
  examinationId: string,
  input: ExaminationUpdateInput,
) {
  return db.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) return { status: "not_found" as const };
    if (current.closesAt <= new Date())
      return { status: "completed" as const };

    const merged = examinationSchema.safeParse({
      title: input.title ?? current.title,
      instructions: input.instructions ?? current.instructions,
      startsAt: input.startsAt ?? current.opensAt.toISOString(),
      endsAt: input.endsAt ?? current.closesAt.toISOString(),
      durationMinutes: input.durationMinutes ?? current.durationMinutes,
      randomizeQuestions:
        input.randomizeQuestions ?? current.randomizeQuestions,
      randomizeOptions: input.randomizeOptions ?? current.randomizeOptions,
    });

    if (!merged.success) {
      return {
        status: "invalid" as const,
        issues: merged.error.issues.map((issue) => issue.message),
      };
    }

    const [updated] = await transaction
      .update(examinations)
      .set({
        ...merged.data,
        opensAt: new Date(merged.data.startsAt),
        closesAt: new Date(merged.data.endsAt),
        updatedAt: new Date(),
      })
      .where(eq(examinations.id, examinationId))
      .returning();

    return { status: "updated" as const, examination: updated };
  });
}

export async function publishExamination(
  examinerId: string,
  examinationId: string,
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select()
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!examination) return { status: "not_found" as const };
    if (examination.status === "PUBLISHED") {
      return { status: "already_published" as const, examination };
    }

    const [assignedQuestions, enrolledCandidates] = await Promise.all([
      transaction
        .select({ id: examinationQuestions.id })
        .from(examinationQuestions)
        .where(eq(examinationQuestions.examinationId, examinationId)),
      transaction
        .select({ id: examinationEnrollments.id })
        .from(examinationEnrollments)
        .where(eq(examinationEnrollments.examinationId, examinationId)),
    ]);
    const issues = getPublicationIssues(
      {
        title: examination.title,
        instructions: examination.instructions,
        startsAt: examination.opensAt,
        endsAt: examination.closesAt,
        durationMinutes: examination.durationMinutes,
        questionCount: assignedQuestions.length,
        candidateCount: enrolledCandidates.length,
      },
      new Date(),
    );

    if (issues.length > 0) {
      return { status: "invalid" as const, issues };
    }

    const now = new Date();
    const [published] = await transaction
      .update(examinations)
      .set({ status: "PUBLISHED", publishedAt: now, updatedAt: now })
      .where(eq(examinations.id, examinationId))
      .returning();

    return { status: "published" as const, examination: published };
  });
}

export async function listQuestionBank(examinerId: string) {
  const records = await db
    .select()
    .from(questions)
    .where(eq(questions.examinerId, examinerId))
    .orderBy(asc(questions.category), desc(questions.updatedAt));
  return records.map(toBankQuestion);
}

export async function createBankQuestion(
  examinerId: string,
  input: QuestionInput,
) {
  const [created] = await db
    .insert(questions)
    .values({ ...questionInputValues(input), examinerId })
    .returning();
  return toBankQuestion(created);
}

export async function updateBankQuestion(
  examinerId: string,
  questionId: string,
  input: QuestionInput,
) {
  const [updated] = await db
    .update(questions)
    .set({ ...questionInputValues(input), updatedAt: new Date() })
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.examinerId, examinerId),
      ),
    )
    .returning();
  return updated ? toBankQuestion(updated) : null;
}

export async function addQuestionToExamination(
  examinerId: string,
  examinationId: string,
  questionId: string,
  marks?: number,
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select({
        id: examinations.id,
        endsAt: examinations.closesAt,
      })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!examination) return { status: "not_found" as const };
    if (examination.endsAt <= new Date())
      return { status: "completed" as const };

    const [question] = await transaction
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.id, questionId),
          eq(questions.examinerId, examinerId),
        ),
      )
      .limit(1);

    if (!question) return { status: "question_not_found" as const };

    const [existingAssignment] = await transaction
      .select({ id: examinationQuestions.id })
      .from(examinationQuestions)
      .where(
        and(
          eq(examinationQuestions.examinationId, examinationId),
          eq(examinationQuestions.questionId, questionId),
        ),
      )
      .limit(1);
    if (existingAssignment) return { status: "already_assigned" as const };

    const current = await transaction
      .select({ position: examinationQuestions.position })
      .from(examinationQuestions)
      .where(eq(examinationQuestions.examinationId, examinationId));
    const position =
      current.reduce((maximum, item) => Math.max(maximum, item.position), 0) +
      1;
    const [assigned] = await transaction
      .insert(examinationQuestions)
      .values({
        examinationId,
        questionId: question.id,
        position,
        marks: marks ?? question.marks,
      })
      .returning();

    await transaction
      .update(examinations)
      .set({
        totalMarks:
          (await transaction
            .select({ marks: examinationQuestions.marks })
            .from(examinationQuestions)
            .where(eq(examinationQuestions.examinationId, examinationId)))
            .reduce((total, item) => total + item.marks, 0),
        updatedAt: new Date(),
      })
      .where(eq(examinations.id, examinationId));

    return { status: "added" as const, question: assigned };
  });
}

export async function updateExaminationQuestions(
  examinerId: string,
  examinationId: string,
  items: { id: string; marks: number }[],
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select({
        id: examinations.id,
        endsAt: examinations.closesAt,
      })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!examination) return { status: "not_found" as const };
    if (examination.endsAt <= new Date())
      return { status: "completed" as const };

    const assigned = await transaction
      .select({ id: examinationQuestions.id, position: examinationQuestions.position })
      .from(examinationQuestions)
      .where(eq(examinationQuestions.examinationId, examinationId))
      .for("update");
    const requestedIds = new Set(items.map((item) => item.id));
    const assignedIds = new Set(assigned.map((item) => item.id));

    if (
      requestedIds.size !== items.length ||
      requestedIds.size !== assignedIds.size ||
      [...requestedIds].some((id) => !assignedIds.has(id))
    ) {
      return { status: "invalid_questions" as const };
    }

    const temporaryStart =
      assigned.reduce((maximum, item) => Math.max(maximum, item.position), 0) +
      assigned.length +
      1;

    for (const [index, item] of items.entries()) {
      await transaction
        .update(examinationQuestions)
        .set({
          position: temporaryStart + index,
        })
        .where(
          and(
            eq(examinationQuestions.id, item.id),
            eq(examinationQuestions.examinationId, examinationId),
          ),
        );
    }

    for (const [index, item] of items.entries()) {
      await transaction
        .update(examinationQuestions)
        .set({ position: index + 1, marks: item.marks })
        .where(
          and(
            eq(examinationQuestions.id, item.id),
            eq(examinationQuestions.examinationId, examinationId),
          ),
        );
    }

    const updatedMarks = await transaction
      .select({ marks: examinationQuestions.marks })
      .from(examinationQuestions)
      .where(eq(examinationQuestions.examinationId, examinationId));
    await transaction
      .update(examinations)
      .set({
        totalMarks: updatedMarks.reduce((total, item) => total + item.marks, 0),
        updatedAt: new Date(),
      })
      .where(eq(examinations.id, examinationId));

    return { status: "updated" as const };
  });
}

export async function removeQuestionFromExamination(
  examinerId: string,
  examinationId: string,
  assignmentId: string,
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select({
        id: examinations.id,
        endsAt: examinations.closesAt,
        status: examinations.status,
      })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!examination) return { status: "not_found" as const };
    if (examination.endsAt <= new Date())
      return { status: "completed" as const };

    if (examination.status === "PUBLISHED") {
      const currentQuestions = await transaction
        .select({ id: examinationQuestions.id })
        .from(examinationQuestions)
        .where(eq(examinationQuestions.examinationId, examinationId));
      if (currentQuestions.length <= 1)
        return { status: "last_question" as const };
    }

    const [removed] = await transaction
      .delete(examinationQuestions)
      .where(
        and(
          eq(examinationQuestions.id, assignmentId),
          eq(examinationQuestions.examinationId, examinationId),
        ),
      )
      .returning({ id: examinationQuestions.id });

    if (!removed) return { status: "not_found" as const };

    const remaining = await transaction
      .select({ id: examinationQuestions.id, position: examinationQuestions.position })
      .from(examinationQuestions)
      .where(eq(examinationQuestions.examinationId, examinationId))
      .orderBy(asc(examinationQuestions.position));
    const temporaryStart =
      remaining.reduce((maximum, item) => Math.max(maximum, item.position), 0) +
      remaining.length +
      1;
    for (const [index, item] of remaining.entries()) {
      await transaction
        .update(examinationQuestions)
        .set({ position: temporaryStart + index })
        .where(eq(examinationQuestions.id, item.id));
    }
    for (const [index, item] of remaining.entries()) {
      await transaction
        .update(examinationQuestions)
        .set({ position: index + 1 })
        .where(eq(examinationQuestions.id, item.id));
    }

    const updatedMarks = await transaction
      .select({ marks: examinationQuestions.marks })
      .from(examinationQuestions)
      .where(eq(examinationQuestions.examinationId, examinationId));
    await transaction
      .update(examinations)
      .set({
        totalMarks: updatedMarks.reduce((total, item) => total + item.marks, 0),
        updatedAt: new Date(),
      })
      .where(eq(examinations.id, examinationId));

    return { status: "removed" as const };
  });
}

export async function searchCandidates(search: string) {
  const query = search.trim();
  if (query.length < 2) return [];

  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.role, "CANDIDATE"), ilike(users.email, `%${query}%`)))
    .orderBy(asc(users.email))
    .limit(20);
}

export async function enrollCandidate(
  examinerId: string,
  examinationId: string,
  candidateId: string,
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select({ id: examinations.id, endsAt: examinations.closesAt })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!examination) return { status: "not_found" as const };
    if (examination.endsAt <= new Date())
      return { status: "completed" as const };

    const [candidate] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, candidateId), eq(users.role, "CANDIDATE")))
      .limit(1);
    if (!candidate) return { status: "candidate_not_found" as const };

    const [enrollment] = await transaction
      .insert(examinationEnrollments)
      .values({ examinationId, candidateId })
      .onConflictDoNothing({
        target: [
          examinationEnrollments.examinationId,
          examinationEnrollments.candidateId,
        ],
      })
      .returning({ id: examinationEnrollments.id });

    return enrollment
      ? { status: "enrolled" as const }
      : { status: "already_enrolled" as const };
  });
}

export async function removeCandidateEnrollment(
  examinerId: string,
  examinationId: string,
  candidateId: string,
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select({
        id: examinations.id,
        endsAt: examinations.closesAt,
        status: examinations.status,
      })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);

    if (!examination) return { status: "not_found" as const };
    if (examination.endsAt <= new Date())
      return { status: "completed" as const };

    if (examination.status === "PUBLISHED") {
      const currentEnrollments = await transaction
        .select({ id: examinationEnrollments.id })
        .from(examinationEnrollments)
        .where(eq(examinationEnrollments.examinationId, examinationId));
      if (currentEnrollments.length <= 1)
        return { status: "last_candidate" as const };
    }

    const [removed] = await transaction
      .delete(examinationEnrollments)
      .where(
        and(
          eq(examinationEnrollments.examinationId, examinationId),
          eq(examinationEnrollments.candidateId, candidateId),
        ),
      )
      .returning({ id: examinationEnrollments.id });

    return removed ? { status: "removed" as const } : { status: "not_found" as const };
  });
}

export async function listCandidateExaminations(candidateId: string) {
  const records = await db
    .select({
      examination: examinations,
      enrolledAt: examinationEnrollments.enrolledAt,
    })
    .from(examinationEnrollments)
    .innerJoin(
      examinations,
      eq(examinationEnrollments.examinationId, examinations.id),
    )
    .where(
      and(
        eq(examinationEnrollments.candidateId, candidateId),
        eq(examinations.status, "PUBLISHED"),
      ),
    )
    .orderBy(asc(examinations.opensAt));

  if (records.length === 0) return [];

  const ids = records.map((record) => record.examination.id);
  const assignedQuestions = await db
    .select({
      examinationId: examinationQuestions.examinationId,
      id: examinationQuestions.id,
    })
    .from(examinationQuestions)
    .where(inArray(examinationQuestions.examinationId, ids));
  const now = new Date();

  return records.map(({ examination, enrolledAt }) => {
    const examQuestions = assignedQuestions.filter(
      (question) => question.examinationId === examination.id,
    );
    return {
      id: examination.id,
      title: examination.title,
      instructions: examination.instructions,
      startsAt: examination.opensAt,
      endsAt: examination.closesAt,
      durationMinutes: examination.durationMinutes,
      publishedAt: examination.publishedAt,
      enrolledAt,
      availability: publishedAvailability(
        examination.opensAt,
        examination.closesAt,
        now,
      ),
      questionCount: examQuestions.length,
      totalMarks: examination.totalMarks,
    };
  });
}

export async function getCandidateExamination(
  candidateId: string,
  examinationId: string,
) {
  const [record] = await db
    .select({
      examination: examinations,
      enrolledAt: examinationEnrollments.enrolledAt,
    })
    .from(examinationEnrollments)
    .innerJoin(
      examinations,
      eq(examinationEnrollments.examinationId, examinations.id),
    )
    .where(
      and(
        eq(examinationEnrollments.examinationId, examinationId),
        eq(examinationEnrollments.candidateId, candidateId),
        eq(examinations.status, "PUBLISHED"),
      ),
    )
    .limit(1);

  if (!record) return null;

  const { examination, enrolledAt } = record;
  const now = new Date();
  const availability = publishedAvailability(
    examination.opensAt,
    examination.closesAt,
    now,
  );
  if (availability !== "ongoing") return null;

  const assignedQuestions = await db
    .select({ id: examinationQuestions.id })
    .from(examinationQuestions)
    .where(eq(examinationQuestions.examinationId, examinationId));

  return {
    id: examination.id,
    title: examination.title,
    instructions: examination.instructions,
    startsAt: examination.opensAt,
    endsAt: examination.closesAt,
    durationMinutes: examination.durationMinutes,
    publishedAt: examination.publishedAt,
    enrolledAt,
    availability,
    questionCount: assignedQuestions.length,
    totalMarks: examination.totalMarks,
  };
}
