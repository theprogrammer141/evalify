import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attemptAnswers,
  attempts,
  examinationEnrollments,
  examinationReports,
  evaluations,
  examinations,
  issuedReports,
  users,
} from "@/lib/db/schema";
import { attemptSnapshotSchema } from "@/lib/attempts/validation";
import {
  issuedReportSnapshotSchema,
  performanceReportSnapshotSchema,
  type PerformanceReportSnapshot,
} from "@/lib/reports/validation";
import {
  aggregateQuestionAnalytics,
  calculatePerformanceMetrics,
  scorePercentage,
  type CandidatePerformance,
} from "@/lib/reports/analytics";

export class ReportServiceError extends Error {
  constructor(
    readonly code: "not_found" | "not_published" | "report_revoked",
    readonly status: number,
  ) {
    super(code);
    this.name = "ReportServiceError";
  }
}

function readMaximumMarks(snapshot: unknown) {
  const parsed = attemptSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error("invalid_attempt_snapshot");
  return parsed.data.questions.reduce(
    (total, question) => total + question.marks,
    0,
  );
}

function readIssuedReportSnapshot(snapshot: unknown) {
  const parsed = issuedReportSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error("invalid_issued_report_snapshot");
  return parsed.data;
}

export async function listExaminerReports(examinerId: string) {
  const rows = await db
    .select({
      examinationId: examinations.id,
      examinationTitle: examinations.title,
      attemptId: attempts.id,
      attemptStatus: attempts.status,
      completedAt: attempts.finalizedAt,
      snapshot: attempts.snapshot,
      candidateId: users.id,
      candidateEmail: users.email,
      evaluationStatus: evaluations.status,
      totalMarks: evaluations.totalMarks,
      autoMarks: evaluations.autoMarks,
      manualMarks: evaluations.manualMarks,
      publishedAt: evaluations.publishedAt,
      reportId: issuedReports.id,
      reportStatus: issuedReports.status,
      verificationToken: issuedReports.verificationToken,
      issuedAt: issuedReports.issuedAt,
      reportSnapshot: issuedReports.reportSnapshot,
    })
    .from(attempts)
    .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
    .innerJoin(evaluations, eq(attempts.id, evaluations.attemptId))
    .innerJoin(users, eq(attempts.candidateId, users.id))
    .leftJoin(issuedReports, eq(evaluations.id, issuedReports.evaluationId))
    .where(eq(examinations.examinerId, examinerId))
    .orderBy(asc(examinations.title), desc(attempts.finalizedAt));

  const examinationsById = new Map<
    string,
    {
      id: string;
      title: string;
      results: {
        attemptId: string;
        candidateId: string;
        candidateEmail: string;
        attemptStatus: "SUBMITTED" | "EXPIRED" | "IN_PROGRESS";
        completedAt: string | null;
        evaluationStatus:
          | "AUTO_GRADED"
          | "AWAITING_MANUAL"
          | "PARTIALLY_EVALUATED"
          | "COMPLETED"
          | "FINALIZED";
        totalMarks: number;
        autoMarks: number;
        manualMarks: number;
        maximumMarks: number;
        publishedAt: string | null;
        issuedReport: null | {
          id: string;
          status: "VALID" | "REVOKED";
          verificationToken: string;
          issuedAt: string;
        };
      }[];
    }
  >();

  for (const row of rows) {
    const reportSnapshot = row.reportSnapshot
      ? readIssuedReportSnapshot(row.reportSnapshot)
      : null;
    const examination = examinationsById.get(row.examinationId) ?? {
      id: row.examinationId,
      title: reportSnapshot?.examinationTitle ?? row.examinationTitle,
      results: [],
    };
    examination.results.push({
      attemptId: row.attemptId,
      candidateId: row.candidateId,
      candidateEmail: reportSnapshot?.candidateEmail ?? row.candidateEmail,
      attemptStatus: row.attemptStatus,
      completedAt: row.completedAt?.toISOString() ?? null,
      evaluationStatus: row.evaluationStatus,
      totalMarks: row.totalMarks,
      autoMarks: row.autoMarks,
      manualMarks: row.manualMarks,
      maximumMarks: readMaximumMarks(row.snapshot),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      issuedReport:
        row.reportId && row.reportStatus && row.verificationToken && row.issuedAt
          ? {
              id: row.reportId,
              status: row.reportStatus,
              verificationToken: row.verificationToken,
              issuedAt: row.issuedAt.toISOString(),
            }
          : null,
    });
    examinationsById.set(row.examinationId, examination);
  }

  return [...examinationsById.values()];
}

export async function getExaminerPerformanceReport(
  examinerId: string,
  examinationId: string,
) {
  const [examination] = await db
    .select({
      id: examinations.id,
      title: examinations.title,
      opensAt: examinations.opensAt,
      closesAt: examinations.closesAt,
      durationMinutes: examinations.durationMinutes,
    })
    .from(examinations)
    .where(
      and(
        eq(examinations.id, examinationId),
        eq(examinations.examinerId, examinerId),
      ),
    )
    .limit(1);
  if (!examination) throw new ReportServiceError("not_found", 404);

  const rows = await db
    .select({
      candidateEmail: users.email,
      attemptStatus: attempts.status,
      completedAt: attempts.finalizedAt,
      snapshot: attempts.snapshot,
      evaluationStatus: evaluations.status,
      totalMarks: evaluations.totalMarks,
      autoMarks: evaluations.autoMarks,
      manualMarks: evaluations.manualMarks,
      publishedAt: evaluations.publishedAt,
    })
    .from(attempts)
    .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
    .innerJoin(users, eq(attempts.candidateId, users.id))
    .leftJoin(evaluations, eq(attempts.id, evaluations.attemptId))
    .where(
      and(
        eq(examinations.id, examinationId),
        eq(examinations.examinerId, examinerId),
        inArray(attempts.status, ["SUBMITTED", "EXPIRED"]),
      ),
    )
    .orderBy(asc(users.email));

  const enrollments = await db
    .select({ id: examinationEnrollments.id })
    .from(examinationEnrollments)
    .where(eq(examinationEnrollments.examinationId, examinationId));
  const eligibleRows = rows.filter(
    (
      row,
    ): row is typeof row & {
      attemptStatus: "SUBMITTED" | "EXPIRED";
    } => row.attemptStatus !== "IN_PROGRESS",
  );
  const candidates: (CandidatePerformance & { percentage: number | null })[] =
    eligibleRows.map((row) => {
      const maximumMarks = readMaximumMarks(row.snapshot);
      const finalized =
        row.evaluationStatus === "FINALIZED" && row.totalMarks !== null;
      return {
        candidateEmail: row.candidateEmail,
        attemptStatus: row.attemptStatus,
        completedAt: row.completedAt?.toISOString() ?? null,
        evaluationStatus: row.evaluationStatus,
        totalMarks: row.totalMarks,
        autoMarks: row.autoMarks,
        manualMarks: row.manualMarks,
        maximumMarks,
        published: row.publishedAt !== null,
        percentage:
          finalized && row.totalMarks !== null
            ? scorePercentage(row.totalMarks, maximumMarks)
            : null,
      };
    });
  const metrics = calculatePerformanceMetrics(candidates, enrollments.length);

  return {
    ...examination,
    opensAt: examination.opensAt.toISOString(),
    closesAt: examination.closesAt.toISOString(),
    generatedAt: new Date().toISOString(),
    ...metrics,
    candidates,
  };
}

export async function listExaminerReportExaminations(examinerId: string) {
  return db
    .select({
      id: examinations.id,
      title: examinations.title,
      status: examinations.status,
      opensAt: examinations.opensAt,
      closesAt: examinations.closesAt,
    })
    .from(examinations)
    .where(eq(examinations.examinerId, examinerId))
    .orderBy(desc(examinations.updatedAt), asc(examinations.title));
}

export async function getExaminerQuestionAnalytics(
  examinerId: string,
  examinationId: string,
) {
  const [examination] = await db
    .select({ id: examinations.id })
    .from(examinations)
    .where(
      and(
        eq(examinations.id, examinationId),
        eq(examinations.examinerId, examinerId),
      ),
    )
    .limit(1);
  if (!examination) throw new ReportServiceError("not_found", 404);

  const attemptsWithSnapshots = await db
    .select({ id: attempts.id, snapshot: attempts.snapshot })
    .from(attempts)
    .where(
      and(
        eq(attempts.examinationId, examinationId),
        inArray(attempts.status, ["SUBMITTED", "EXPIRED"]),
      ),
    );
  if (attemptsWithSnapshots.length === 0) {
    return { examinationId, questions: [] };
  }

  const attemptIds = attemptsWithSnapshots.map((attempt) => attempt.id);
  const answers = await db
    .select({
      attemptId: attemptAnswers.attemptId,
      questionId: attemptAnswers.snapshotQuestionId,
      answer: attemptAnswers.answer,
    })
    .from(attemptAnswers)
    .where(inArray(attemptAnswers.attemptId, attemptIds));
  const answersByAttempt = new Map<
    string,
    Map<string, (typeof answers)[number]["answer"]>
  >();
  for (const answer of answers) {
    const attemptAnswersMap = answersByAttempt.get(answer.attemptId) ?? new Map();
    attemptAnswersMap.set(answer.questionId, answer.answer);
    answersByAttempt.set(answer.attemptId, attemptAnswersMap);
  }

  const questionAttempts = attemptsWithSnapshots.map((attempt) => {
    const parsedSnapshot = attemptSnapshotSchema.safeParse(attempt.snapshot);
    if (!parsedSnapshot.success) throw new Error("invalid_attempt_snapshot");
    return {
      snapshot: parsedSnapshot.data,
      answers: answersByAttempt.get(attempt.id) ?? new Map(),
    };
  });
  return {
    examinationId,
    questions: aggregateQuestionAnalytics(questionAttempts),
  };
}

export async function listExaminerPerformanceReports(
  examinerId: string,
  examinationId: string,
) {
  const rows = await db
    .select({
      id: examinationReports.id,
      generatedAt: examinationReports.generatedAt,
      verificationToken: examinationReports.verificationToken,
      reportSnapshot: examinationReports.reportSnapshot,
      generatedByEmail: users.email,
    })
    .from(examinationReports)
    .innerJoin(examinations, eq(examinationReports.examinationId, examinations.id))
    .innerJoin(users, eq(examinationReports.generatedBy, users.id))
    .where(
      and(
        eq(examinationReports.examinationId, examinationId),
        eq(examinations.examinerId, examinerId),
      ),
    )
    .orderBy(desc(examinationReports.generatedAt));

  return rows.map((row) => {
    const snapshot = performanceReportSnapshotSchema.parse(row.reportSnapshot);
    return {
      id: row.id,
      generatedAt: row.generatedAt.toISOString(),
      verificationToken: row.verificationToken,
      generatedByEmail: row.generatedByEmail,
      reportStage: snapshot.reportStage,
      candidateCount: snapshot.submittedCount,
    };
  });
}

export async function saveExaminerPerformanceReport(
  examinerId: string,
  verificationToken: string,
  report: PerformanceReportSnapshot,
) {
  const snapshot = performanceReportSnapshotSchema.parse(report);
  return db.transaction(async (transaction) => {
    const [examination] = await transaction
      .select({ id: examinations.id })
      .from(examinations)
      .where(
        and(
          eq(examinations.id, snapshot.id),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .limit(1);
    if (!examination) throw new ReportServiceError("not_found", 404);

    const [record] = await transaction
      .insert(examinationReports)
      .values({
        examinationId: snapshot.id,
        generatedBy: examinerId,
        verificationToken,
        reportSnapshot: snapshot,
        generatedAt: new Date(snapshot.generatedAt),
      })
      .returning({
        id: examinationReports.id,
        generatedAt: examinationReports.generatedAt,
        verificationToken: examinationReports.verificationToken,
      });
    return {
      ...record,
      generatedAt: record.generatedAt.toISOString(),
      verificationUrl: `/verify/${record.verificationToken}`,
    };
  });
}

export async function getExaminerPerformanceReportRecord(
  examinerId: string,
  reportId: string,
) {
  const [record] = await db
    .select({
      id: examinationReports.id,
      examinationId: examinationReports.examinationId,
      generatedAt: examinationReports.generatedAt,
      verificationToken: examinationReports.verificationToken,
      reportSnapshot: examinationReports.reportSnapshot,
    })
    .from(examinationReports)
    .innerJoin(examinations, eq(examinationReports.examinationId, examinations.id))
    .where(
      and(
        eq(examinationReports.id, reportId),
        eq(examinations.examinerId, examinerId),
      ),
    )
    .limit(1);
  if (!record) throw new ReportServiceError("not_found", 404);

  return {
    id: record.id,
    examinationId: record.examinationId,
    generatedAt: record.generatedAt.toISOString(),
    verificationToken: record.verificationToken,
    report: performanceReportSnapshotSchema.parse(record.reportSnapshot),
  };
}

export async function getPublicReportVerification(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: "nonexistent" as const };

  const [candidateReport] = await db
    .select({
      status: issuedReports.status,
      issuedAt: issuedReports.issuedAt,
      reportSnapshot: issuedReports.reportSnapshot,
    })
    .from(issuedReports)
    .where(eq(issuedReports.verificationToken, token))
    .limit(1);

  if (candidateReport) {
    const snapshot = readIssuedReportSnapshot(candidateReport.reportSnapshot);
    return {
      status:
        candidateReport.status === "VALID"
          ? ("valid" as const)
          : ("revoked" as const),
      reportType: "Candidate result report" as const,
      examinationTitle: snapshot.examinationTitle,
      dateLabel: "Issued" as const,
      issuedAt: candidateReport.issuedAt.toISOString(),
    };
  }

  const [performanceReport] = await db
    .select({
      generatedAt: examinationReports.generatedAt,
      reportSnapshot: examinationReports.reportSnapshot,
    })
    .from(examinationReports)
    .where(eq(examinationReports.verificationToken, token))
    .limit(1);

  if (!performanceReport) return { status: "nonexistent" as const };
  const snapshot = performanceReportSnapshotSchema.parse(
    performanceReport.reportSnapshot,
  );
  return {
    status: "valid" as const,
    reportType: "Examination performance report" as const,
    examinationTitle: snapshot.title,
    dateLabel: "Generated" as const,
    issuedAt: performanceReport.generatedAt.toISOString(),
  };
}

export async function issueCandidateResultReport(
  examinerId: string,
  attemptId: string,
) {
  return db.transaction(async (transaction) => {
    const [evaluation] = await transaction
      .select({
        id: evaluations.id,
        status: evaluations.status,
        publishedAt: evaluations.publishedAt,
        examinationId: attempts.examinationId,
        candidateId: attempts.candidateId,
        examinationTitle: examinations.title,
        candidateEmail: users.email,
        opensAt: examinations.opensAt,
        closesAt: examinations.closesAt,
        durationMinutes: examinations.durationMinutes,
        attemptStatus: attempts.status,
        completedAt: attempts.finalizedAt,
        questionSnapshot: attempts.snapshot,
        totalMarks: evaluations.totalMarks,
        autoMarks: evaluations.autoMarks,
        manualMarks: evaluations.manualMarks,
      })
      .from(evaluations)
      .innerJoin(attempts, eq(evaluations.attemptId, attempts.id))
      .innerJoin(examinations, eq(attempts.examinationId, examinations.id))
      .innerJoin(users, eq(attempts.candidateId, users.id))
      .where(
        and(
          eq(evaluations.attemptId, attemptId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);
    if (!evaluation) throw new ReportServiceError("not_found", 404);
    if (
      evaluation.status !== "FINALIZED" ||
      !evaluation.publishedAt ||
      (evaluation.attemptStatus !== "SUBMITTED" &&
        evaluation.attemptStatus !== "EXPIRED") ||
      !evaluation.completedAt
    ) {
      throw new ReportServiceError("not_published", 409);
    }
    const reportSnapshot = issuedReportSnapshotSchema.parse({
      examinationTitle: evaluation.examinationTitle,
      candidateEmail: evaluation.candidateEmail,
      opensAt: evaluation.opensAt.toISOString(),
      closesAt: evaluation.closesAt.toISOString(),
      durationMinutes: evaluation.durationMinutes,
      attemptStatus: evaluation.attemptStatus,
      completedAt: evaluation.completedAt.toISOString(),
      totalMarks: evaluation.totalMarks,
      autoMarks: evaluation.autoMarks,
      manualMarks: evaluation.manualMarks,
      maximumMarks: readMaximumMarks(evaluation.questionSnapshot),
      publishedAt: evaluation.publishedAt.toISOString(),
    });

    const [existing] = await transaction
      .select({
        id: issuedReports.id,
        status: issuedReports.status,
        verificationToken: issuedReports.verificationToken,
        issuedAt: issuedReports.issuedAt,
      })
      .from(issuedReports)
      .where(eq(issuedReports.evaluationId, evaluation.id))
      .for("update")
      .limit(1);
    if (existing) {
      if (existing.status === "REVOKED") {
        throw new ReportServiceError("report_revoked", 409);
      }
      return {
        ...existing,
        issuedAt: existing.issuedAt.toISOString(),
        verificationUrl: `/verify/${existing.verificationToken}`,
      };
    }

    const [report] = await transaction
      .insert(issuedReports)
      .values({
        examinationId: evaluation.examinationId,
        attemptId,
        evaluationId: evaluation.id,
        candidateId: evaluation.candidateId,
        verificationToken: randomBytes(32).toString("hex"),
        reportSnapshot,
        issuedBy: examinerId,
      })
      .returning({
        id: issuedReports.id,
        status: issuedReports.status,
        verificationToken: issuedReports.verificationToken,
        issuedAt: issuedReports.issuedAt,
      });

    return {
      ...report,
      issuedAt: report.issuedAt.toISOString(),
      verificationUrl: `/verify/${report.verificationToken}`,
    };
  });
}

export async function revokeCandidateResultReport(
  examinerId: string,
  reportId: string,
) {
  return db.transaction(async (transaction) => {
    const [report] = await transaction
      .select({
        id: issuedReports.id,
        status: issuedReports.status,
        verificationToken: issuedReports.verificationToken,
        issuedAt: issuedReports.issuedAt,
        revokedAt: issuedReports.revokedAt,
      })
      .from(issuedReports)
      .innerJoin(examinations, eq(issuedReports.examinationId, examinations.id))
      .where(
        and(
          eq(issuedReports.id, reportId),
          eq(examinations.examinerId, examinerId),
        ),
      )
      .for("update")
      .limit(1);
    if (!report) throw new ReportServiceError("not_found", 404);
    if (report.status === "REVOKED") {
      return {
        ...report,
        issuedAt: report.issuedAt.toISOString(),
        revokedAt: report.revokedAt?.toISOString() ?? null,
      };
    }

    const revokedAt = new Date();
    const [revoked] = await transaction
      .update(issuedReports)
      .set({ status: "REVOKED", revokedBy: examinerId, revokedAt })
      .where(eq(issuedReports.id, reportId))
      .returning({
        id: issuedReports.id,
        status: issuedReports.status,
        verificationToken: issuedReports.verificationToken,
        issuedAt: issuedReports.issuedAt,
        revokedAt: issuedReports.revokedAt,
      });
    return {
      ...revoked,
      issuedAt: revoked.issuedAt.toISOString(),
      revokedAt: revoked.revokedAt?.toISOString() ?? null,
    };
  });
}

async function findIssuedReport(
  reportId: string,
  access: { examinerId?: string; candidateId?: string },
) {
  const predicates = [eq(issuedReports.id, reportId)];
  if (access.examinerId) {
    predicates.push(eq(examinations.examinerId, access.examinerId));
  }
  if (access.candidateId) {
    predicates.push(eq(issuedReports.candidateId, access.candidateId));
  }

  const [row] = await db
    .select({
      id: issuedReports.id,
      status: issuedReports.status,
      verificationToken: issuedReports.verificationToken,
      issuedAt: issuedReports.issuedAt,
      revokedAt: issuedReports.revokedAt,
      reportSnapshot: issuedReports.reportSnapshot,
    })
    .from(issuedReports)
    .innerJoin(examinations, eq(issuedReports.examinationId, examinations.id))
    .where(and(...predicates))
    .limit(1);
  if (!row) throw new ReportServiceError("not_found", 404);

  const reportSnapshot = readIssuedReportSnapshot(row.reportSnapshot);
  const report = {
    ...reportSnapshot,
    id: row.id,
    status: row.status,
    verificationToken: row.verificationToken,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    verificationUrl: `/verify/${row.verificationToken}`,
  };
  if (report.status === "REVOKED") {
    throw new ReportServiceError("report_revoked", 409);
  }
  return report;
}

export function getExaminerIssuedReport(examinerId: string, reportId: string) {
  return findIssuedReport(reportId, { examinerId });
}

export function getCandidateIssuedReport(candidateId: string, reportId: string) {
  return findIssuedReport(reportId, { candidateId });
}

export async function listCandidateIssuedReports(candidateId: string) {
  const rows = await db
    .select({
      id: issuedReports.id,
      status: issuedReports.status,
      issuedAt: issuedReports.issuedAt,
      revokedAt: issuedReports.revokedAt,
      reportSnapshot: issuedReports.reportSnapshot,
    })
    .from(issuedReports)
    .where(eq(issuedReports.candidateId, candidateId))
    .orderBy(desc(issuedReports.issuedAt));

  return rows.map((row) => {
    const snapshot = readIssuedReportSnapshot(row.reportSnapshot);
    return {
      id: row.id,
      status: row.status,
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      candidateEmail: snapshot.candidateEmail,
      examinationTitle: snapshot.examinationTitle,
      totalMarks: snapshot.totalMarks,
      maximumMarks: snapshot.maximumMarks,
      publishedAt: snapshot.publishedAt,
    };
  });
}
