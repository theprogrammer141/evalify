import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lte,
} from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import {
  announcementReads,
  examinationAttemptAnswers,
  attemptQuestions,
  examinationAnnouncements,
  examinationAttempts,
  examinationEnrollments,
  examinationQuestions,
  examinations,
  questions,
  monitoringEvents,
  users,
} from "@/lib/db/schema";
import type {
  AnnouncementInput,
  AttemptAnswerInput,
  MonitoringEventInput,
} from "@/lib/monitoring/validation";
import {
  getAttemptStatusCounts,
  getQuestionProgress,
} from "@/lib/monitoring/progress";

type Authorization = { userId: string; isAdmin: boolean };

async function findAccessibleExamination(
  examinationId: string,
  authorization: Authorization,
) {
  const conditions = [eq(examinations.id, examinationId)];
  if (!authorization.isAdmin) {
    conditions.push(eq(examinations.examinerId, authorization.userId));
  }
  const [examination] = await db
    .select()
    .from(examinations)
    .where(and(...conditions))
    .limit(1);
  return examination ?? null;
}

function shuffle<T>(values: T[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function getAnswerKey(
  question: Pick<typeof questions.$inferSelect, "type" | "markingRules">,
) {
  if (
    question.type === "SINGLE_CHOICE" &&
    typeof question.markingRules.correctOptionId === "string"
  ) {
    return [question.markingRules.correctOptionId];
  }
  if (
    question.type === "MULTIPLE_SELECT" &&
    Array.isArray(question.markingRules.correctOptionIds)
  ) {
    return question.markingRules.correctOptionIds.filter(
      (id): id is string => typeof id === "string",
    );
  }
  return [];
}

async function finalizeExpiredAttempts(examinationId: string, now = new Date()) {
  await db
    .update(examinationAttempts)
    .set({ status: "EXPIRED", finalizedAt: now })
    .where(
      and(
        eq(examinationAttempts.examinationId, examinationId),
        eq(examinationAttempts.status, "IN_PROGRESS"),
        lte(examinationAttempts.expiresAt, now),
      ),
    );
}

export async function getMonitoringDashboard(
  examinationId: string,
  authorization: Authorization,
) {
  const examination = await findAccessibleExamination(
    examinationId,
    authorization,
  );
  if (!examination) return null;

  const now = new Date();
  await finalizeExpiredAttempts(examinationId, now);
  const [enrollments, attempts, events, announcements] = await Promise.all([
    db
      .select({
        candidateId: examinationEnrollments.candidateId,
        email: users.email,
      })
      .from(examinationEnrollments)
      .innerJoin(users, eq(examinationEnrollments.candidateId, users.id))
      .where(eq(examinationEnrollments.examinationId, examinationId))
      .orderBy(asc(users.email)),
    db
      .select()
      .from(examinationAttempts)
      .where(eq(examinationAttempts.examinationId, examinationId)),
    db
      .select({
        id: monitoringEvents.id,
        candidateEmail: users.email,
        type: monitoringEvents.type,
        context: monitoringEvents.context,
        recordedAt: monitoringEvents.recordedAt,
      })
      .from(monitoringEvents)
      .innerJoin(users, eq(monitoringEvents.candidateId, users.id))
      .where(eq(monitoringEvents.examinationId, examinationId))
      .orderBy(desc(monitoringEvents.recordedAt)),
    queryExaminerAnnouncements(examinationId),
  ]);
  const attemptIds = attempts.map((attempt) => attempt.id);
  const [questions, answers] =
    attemptIds.length > 0
      ? await Promise.all([
          db
            .select({
              attemptId: attemptQuestions.attemptId,
              id: attemptQuestions.id,
            })
            .from(attemptQuestions)
            .where(inArray(attemptQuestions.attemptId, attemptIds)),
          db
            .select({
              attemptId: examinationAttemptAnswers.attemptId,
              questionId: examinationAttemptAnswers.questionId,
              response: examinationAttemptAnswers.response,
              markedForReview: examinationAttemptAnswers.markedForReview,
              updatedAt: examinationAttemptAnswers.updatedAt,
            })
            .from(examinationAttemptAnswers)
            .where(inArray(examinationAttemptAnswers.attemptId, attemptIds)),
        ])
      : [[], []];
  const attemptByCandidate = new Map(
    attempts.map((attempt) => [attempt.candidateId, attempt]),
  );

  const candidates = enrollments.map(({ candidateId, email }) => {
    const attempt = attemptByCandidate.get(candidateId);
    if (!attempt) {
      return {
        candidateId,
        email,
        status: "NOT_STARTED" as const,
        startedAt: null,
        expiresAt: null,
        submittedAt: null,
        remainingSeconds: null,
        questionCount: 0,
        answeredCount: 0,
        unansweredCount: 0,
        reviewCount: 0,
      };
    }

    const attemptQuestionsForCandidate = questions.filter(
      (question) => question.attemptId === attempt.id,
    );
    const answersForCandidate = answers.filter(
      (answer) => answer.attemptId === attempt.id,
    );
    const progress = getQuestionProgress(
      attemptQuestionsForCandidate.map((question) => question.id),
      answersForCandidate,
    );

    return {
      candidateId,
      email,
      attemptId: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      remainingSeconds:
        attempt.status === "IN_PROGRESS"
          ? Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))
          : null,
      ...progress,
    };
  });
  const counts = getAttemptStatusCounts(
    candidates.map((candidate) => candidate.status),
  );

  return {
    examination: {
      id: examination.id,
      title: examination.title,
      startsAt: examination.opensAt,
      endsAt: examination.closesAt,
      status: examination.status,
    },
    serverTime: now,
    counts,
    candidates,
    events,
    announcements,
  };
}

export async function listAdminMonitorableExaminations() {
  return db
    .select({
      id: examinations.id,
      title: examinations.title,
      startsAt: examinations.opensAt,
      endsAt: examinations.closesAt,
      status: examinations.status,
      examinerEmail: users.email,
    })
    .from(examinations)
    .innerJoin(users, eq(examinations.examinerId, users.id))
    .where(eq(examinations.status, "PUBLISHED"))
    .orderBy(desc(examinations.updatedAt), asc(examinations.title));
}

export async function startCandidateAttempt(
  candidateId: string,
  examinationId: string,
) {
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select()
      .from(examinations)
      .where(
        and(
          eq(examinations.id, examinationId),
          eq(examinations.status, "PUBLISHED"),
        ),
      )
      .for("update")
      .limit(1);
    if (!examination) return { status: "not_found" as const };

    const [enrollment] = await transaction
      .select({ id: examinationEnrollments.id })
      .from(examinationEnrollments)
      .where(
        and(
          eq(examinationEnrollments.examinationId, examinationId),
          eq(examinationEnrollments.candidateId, candidateId),
        ),
      )
      .limit(1);
    if (!enrollment) return { status: "not_found" as const };

    const now = new Date();
    const [existing] = await transaction
      .select()
      .from(examinationAttempts)
      .where(
        and(
          eq(examinationAttempts.examinationId, examinationId),
          eq(examinationAttempts.candidateId, candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (existing) {
      if (existing.status === "IN_PROGRESS" && existing.expiresAt <= now) {
        const [expired] = await transaction
          .update(examinationAttempts)
          .set({ status: "EXPIRED", finalizedAt: now })
          .where(eq(examinationAttempts.id, existing.id))
          .returning();
        return { status: "existing" as const, attempt: expired };
      }
      return { status: "existing" as const, attempt: existing };
    }

    if (
      examination.opensAt > now ||
      examination.closesAt <= now
    ) {
      return { status: "unavailable" as const };
    }

    const sourceQuestions = await transaction
      .select({
        id: examinationQuestions.id,
        position: examinationQuestions.position,
        marks: examinationQuestions.marks,
        prompt: questions.prompt,
        type: questions.type,
        options: questions.options,
        markingRules: questions.markingRules,
      })
      .from(examinationQuestions)
      .innerJoin(
        questions,
        eq(examinationQuestions.questionId, questions.id),
      )
      .where(eq(examinationQuestions.examinationId, examinationId))
      .orderBy(asc(examinationQuestions.position));
    if (sourceQuestions.length === 0)
      return { status: "unavailable" as const };

    const expiresAt = new Date(
      Math.min(
        now.getTime() + examination.durationMinutes * 60_000,
        examination.closesAt.getTime(),
      ),
    );
    const orderedQuestions = examination.randomizeQuestions
      ? shuffle(sourceQuestions)
      : sourceQuestions;
    const [attempt] = await transaction
      .insert(examinationAttempts)
      .values({
        examinationId,
        candidateId,
        status: "IN_PROGRESS",
        startedAt: now,
        expiresAt,
      })
      .returning();
    await transaction.insert(attemptQuestions).values(
      orderedQuestions.map((question, index) => ({
        attemptId: attempt.id,
        sourceAssignmentId: question.id,
        position: index + 1,
        prompt: question.prompt,
        type: question.type,
        marks: question.marks,
        options: examination.randomizeOptions
          ? shuffle(question.options)
          : question.options,
        answerKey: getAnswerKey(question),
      })),
    );

    return { status: "started" as const, attempt };
  });
}

export async function getCandidateAttempt(
  candidateId: string,
  examinationId: string,
) {
  const [enrollment] = await db
    .select({ id: examinationEnrollments.id })
    .from(examinationEnrollments)
    .innerJoin(
      examinations,
      eq(examinationEnrollments.examinationId, examinations.id),
    )
    .where(
      and(
        eq(examinationEnrollments.candidateId, candidateId),
        eq(examinationEnrollments.examinationId, examinationId),
        eq(examinations.status, "PUBLISHED"),
      ),
    )
    .limit(1);
  if (!enrollment) return null;

  await finalizeExpiredAttempts(examinationId);
  const [attempt] = await db
    .select()
    .from(examinationAttempts)
    .where(
      and(
        eq(examinationAttempts.examinationId, examinationId),
        eq(examinationAttempts.candidateId, candidateId),
      ),
    )
    .limit(1);
  if (!attempt) return null;

  const questions = await db
    .select({
      id: attemptQuestions.id,
      position: attemptQuestions.position,
      prompt: attemptQuestions.prompt,
      type: attemptQuestions.type,
      marks: attemptQuestions.marks,
      options: attemptQuestions.options,
    })
    .from(attemptQuestions)
    .where(eq(attemptQuestions.attemptId, attempt.id))
    .orderBy(asc(attemptQuestions.position));
  const answers = await db
    .select({
      questionId: examinationAttemptAnswers.questionId,
      response: examinationAttemptAnswers.response,
      markedForReview: examinationAttemptAnswers.markedForReview,
      updatedAt: examinationAttemptAnswers.updatedAt,
    })
    .from(examinationAttemptAnswers)
    .where(eq(examinationAttemptAnswers.attemptId, attempt.id));
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  const now = new Date();

  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    serverTime: now,
    remainingSeconds:
      attempt.status === "IN_PROGRESS"
        ? Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))
        : 0,
    questions: questions.map((question) => ({
      ...question,
      answer: answerByQuestion.get(question.id) ?? null,
    })),
  };
}

export async function saveCandidateAnswer(
  candidateId: string,
  examinationId: string,
  questionId: string,
  input: AttemptAnswerInput,
) {
  return db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(examinationAttempts)
      .where(
        and(
          eq(examinationAttempts.examinationId, examinationId),
          eq(examinationAttempts.candidateId, candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt) return { status: "not_found" as const };
    if (attempt.status !== "IN_PROGRESS")
      return { status: "finalized" as const };
    const now = new Date();
    if (attempt.expiresAt <= now) {
      await transaction
        .update(examinationAttempts)
        .set({ status: "EXPIRED", finalizedAt: now })
        .where(eq(examinationAttempts.id, attempt.id));
      return { status: "expired" as const };
    }

    const [question] = await transaction
      .select()
      .from(attemptQuestions)
      .where(
        and(
          eq(attemptQuestions.id, questionId),
          eq(attemptQuestions.attemptId, attempt.id),
        ),
      )
      .limit(1);
    if (!question) return { status: "not_found" as const };

    const response = input.response;
    if (
      (question.type === "WRITTEN_RESPONSE" && response.type !== "text") ||
      (question.type !== "WRITTEN_RESPONSE" && response.type !== "options")
    ) {
      return { status: "invalid_answer" as const };
    }
    if (
      response.type === "options" &&
      (new Set(response.optionIds).size !== response.optionIds.length ||
        (question.type === "SINGLE_CHOICE" &&
          response.optionIds.length > 1) ||
        response.optionIds.some(
          (id) => !question.options.some((option) => option.id === id),
        ))
    ) {
      return { status: "invalid_answer" as const };
    }

    await transaction
      .insert(examinationAttemptAnswers)
      .values({
        attemptId: attempt.id,
        questionId: question.id,
        response,
        markedForReview: input.markedForReview,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: examinationAttemptAnswers.questionId,
        set: {
          response,
          markedForReview: input.markedForReview,
          updatedAt: now,
        },
      });

    return { status: "saved" as const, savedAt: now };
  });
}

export async function submitCandidateAttempt(
  candidateId: string,
  examinationId: string,
) {
  return db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(examinationAttempts)
      .where(
        and(
          eq(examinationAttempts.examinationId, examinationId),
          eq(examinationAttempts.candidateId, candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt) return { status: "not_found" as const };
    if (attempt.status !== "IN_PROGRESS")
      return { status: "finalized" as const, attempt };
    const now = new Date();
    if (attempt.expiresAt <= now) {
      const [expired] = await transaction
        .update(examinationAttempts)
        .set({ status: "EXPIRED", finalizedAt: now })
        .where(eq(examinationAttempts.id, attempt.id))
        .returning();
      return { status: "expired" as const, attempt: expired };
    }
    const [submitted] = await transaction
      .update(examinationAttempts)
      .set({ status: "SUBMITTED", submittedAt: now, finalizedAt: now })
      .where(eq(examinationAttempts.id, attempt.id))
      .returning();
    return { status: "submitted" as const, attempt: submitted };
  });
}

export async function recordCandidateMonitoringEvent(
  candidateId: string,
  examinationId: string,
  input: MonitoringEventInput,
) {
  return db.transaction(async (transaction) => {
    const [attempt] = await transaction
      .select()
      .from(examinationAttempts)
      .where(
        and(
          eq(examinationAttempts.examinationId, examinationId),
          eq(examinationAttempts.candidateId, candidateId),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt) return { status: "not_found" as const };
    if (attempt.status !== "IN_PROGRESS")
      return { status: "finalized" as const };

    const now = new Date();
    if (attempt.expiresAt <= now) {
      await transaction
        .update(examinationAttempts)
        .set({ status: "EXPIRED", finalizedAt: now })
        .where(eq(examinationAttempts.id, attempt.id));
      return { status: "expired" as const };
    }

    const [event] = await transaction
      .insert(monitoringEvents)
      .values({
        examinationId,
        attemptId: attempt.id,
        candidateId,
        type: input.type,
        context: input.context,
      })
      .returning({ id: monitoringEvents.id });
    return { status: "recorded" as const, id: event.id };
  });
}

export async function listExaminerAnnouncements(
  examinationId: string,
  authorization: Authorization,
) {
  const accessible = await findAccessibleExamination(
    examinationId,
    authorization,
  );
  if (!accessible) return null;
  return queryExaminerAnnouncements(examinationId);
}

async function queryExaminerAnnouncements(examinationId: string) {
  return db
    .select({
      id: examinationAnnouncements.id,
      body: examinationAnnouncements.body,
      publishedAt: examinationAnnouncements.publishedAt,
      senderEmail: users.email,
    })
    .from(examinationAnnouncements)
    .innerJoin(users, eq(examinationAnnouncements.senderId, users.id))
    .where(eq(examinationAnnouncements.examinationId, examinationId))
    .orderBy(desc(examinationAnnouncements.publishedAt));
}

export async function createExaminerAnnouncement(
  examinationId: string,
  authorization: Authorization,
  input: AnnouncementInput,
) {
  return db.transaction(async (transaction) => {
    const conditions = [eq(examinations.id, examinationId)];
    if (!authorization.isAdmin) {
      conditions.push(eq(examinations.examinerId, authorization.userId));
    }
    const [examination] = await transaction
      .select()
      .from(examinations)
      .where(and(...conditions))
      .for("update")
      .limit(1);
    if (!examination) return { status: "not_found" as const };

    const now = new Date();
    if (
      examination.status !== "PUBLISHED" ||
      examination.opensAt > now ||
      examination.closesAt <= now
    ) {
      return { status: "unavailable" as const };
    }

    const [announcement] = await transaction
      .insert(examinationAnnouncements)
      .values({
        examinationId,
        senderId: authorization.userId,
        body: input.body,
      })
      .returning();
    return { status: "created" as const, announcement };
  });
}

export async function listCandidateAnnouncements(
  candidateId: string,
  examinationId: string,
) {
  const [enrollment] = await db
    .select({ id: examinationEnrollments.id })
    .from(examinationEnrollments)
    .innerJoin(
      examinations,
      eq(examinationEnrollments.examinationId, examinations.id),
    )
    .where(
      and(
        eq(examinationEnrollments.candidateId, candidateId),
        eq(examinationEnrollments.examinationId, examinationId),
        eq(examinations.status, "PUBLISHED"),
      ),
    )
    .limit(1);
  if (!enrollment) return null;

  return db
    .select({
      id: examinationAnnouncements.id,
      body: examinationAnnouncements.body,
      publishedAt: examinationAnnouncements.publishedAt,
      viewedAt: announcementReads.viewedAt,
    })
    .from(examinationAnnouncements)
    .leftJoin(
      announcementReads,
      and(
        eq(announcementReads.announcementId, examinationAnnouncements.id),
        eq(announcementReads.candidateId, candidateId),
      ),
    )
    .where(eq(examinationAnnouncements.examinationId, examinationId))
    .orderBy(desc(examinationAnnouncements.publishedAt));
}

export async function markCandidateAnnouncementRead(
  candidateId: string,
  examinationId: string,
  announcementId: string,
) {
  const [announcement] = await db
    .select({ id: examinationAnnouncements.id })
    .from(examinationAnnouncements)
    .innerJoin(
      examinationEnrollments,
      eq(
        examinationAnnouncements.examinationId,
        examinationEnrollments.examinationId,
      ),
    )
    .where(
      and(
        eq(examinationAnnouncements.id, announcementId),
        eq(examinationAnnouncements.examinationId, examinationId),
        eq(examinationEnrollments.candidateId, candidateId),
      ),
    )
    .limit(1);
  if (!announcement) return false;

  await db
    .insert(announcementReads)
    .values({ announcementId, candidateId })
    .onConflictDoNothing({
      target: [
        announcementReads.announcementId,
        announcementReads.candidateId,
      ],
    });
  return true;
}
