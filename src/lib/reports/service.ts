import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attempts,
  evaluations,
  examinations,
  issuedReports,
  users,
} from "@/lib/db/schema";
import { attemptSnapshotSchema } from "@/lib/attempts/validation";
import { issuedReportSnapshotSchema } from "@/lib/reports/validation";

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

  const candidates = rows.map((row) => ({
    candidateEmail: row.candidateEmail,
    attemptStatus: row.attemptStatus,
    completedAt: row.completedAt?.toISOString() ?? null,
    evaluationStatus: row.evaluationStatus,
    totalMarks: row.totalMarks,
    autoMarks: row.autoMarks,
    manualMarks: row.manualMarks,
    maximumMarks: readMaximumMarks(row.snapshot),
    published: row.publishedAt !== null,
  }));
  const finalized = candidates.filter(
    (candidate) =>
      candidate.evaluationStatus === "FINALIZED" &&
      candidate.totalMarks !== null,
  );
  const averagePercentage =
    finalized.length === 0
      ? null
      : finalized.reduce(
          (total, candidate) =>
            total +
            ((candidate.totalMarks ?? 0) / candidate.maximumMarks) * 100,
          0,
        ) / finalized.length;

  return {
    ...examination,
    opensAt: examination.opensAt.toISOString(),
    closesAt: examination.closesAt.toISOString(),
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    finalizedCount: finalized.length,
    averagePercentage:
      averagePercentage === null ? null : Math.round(averagePercentage * 10) / 10,
    highestMarks:
      finalized.length === 0
        ? null
        : Math.max(...finalized.map((candidate) => candidate.totalMarks ?? 0)),
    candidates,
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

export async function getPublicReportVerification(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return { status: "nonexistent" as const };

  const [report] = await db
    .select({
      status: issuedReports.status,
      issuedAt: issuedReports.issuedAt,
      reportSnapshot: issuedReports.reportSnapshot,
    })
    .from(issuedReports)
    .where(eq(issuedReports.verificationToken, token))
    .limit(1);

  if (!report) return { status: "nonexistent" as const };
  const snapshot = readIssuedReportSnapshot(report.reportSnapshot);
  return {
    status: report.status === "VALID" ? ("valid" as const) : ("revoked" as const),
    reportType: "Candidate result report" as const,
    examinationTitle: snapshot.examinationTitle,
    issuedAt: report.issuedAt.toISOString(),
  };
}
