import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type { getExaminerIssuedReport, getExaminerPerformanceReport } from "@/lib/reports/service";
import {
  buildCandidateResultReportPdf,
  buildPerformanceReportPdf,
} from "@/lib/reports/pdf";

type PerformanceReport = Awaited<ReturnType<typeof getExaminerPerformanceReport>>;
type CandidateReport = Awaited<ReturnType<typeof getExaminerIssuedReport>>;

function makePerformanceReport(candidateCount: number): PerformanceReport {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Annual mathematics assessment",
    opensAt: "2026-01-01T09:00:00.000Z",
    closesAt: "2026-01-01T12:00:00.000Z",
    durationMinutes: 180,
    generatedAt: "2026-01-02T09:00:00.000Z",
    candidateCount,
    finalizedCount: candidateCount,
    averagePercentage: 81.5,
    highestMarks: 48,
    candidates: Array.from({ length: candidateCount }, (_, index) => ({
      candidateEmail: `candidate-${String(index).padStart(3, "0")}@example.test`,
      attemptStatus: index % 2 === 0 ? "SUBMITTED" : "EXPIRED",
      completedAt: "2026-01-01T11:00:00.000Z",
      evaluationStatus: "FINALIZED",
      totalMarks: 41,
      autoMarks: 26,
      manualMarks: 15,
      maximumMarks: 50,
      published: true,
    })),
  };
}

function makeCandidateReport(): CandidateReport {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    status: "VALID",
    verificationToken: "a".repeat(64),
    issuedAt: "2026-01-02T09:00:00.000Z",
    revokedAt: null,
    candidateEmail: "candidate@example.test",
    examinationTitle: "Annual mathematics assessment",
    opensAt: "2026-01-01T09:00:00.000Z",
    closesAt: "2026-01-01T12:00:00.000Z",
    durationMinutes: 180,
    attemptStatus: "SUBMITTED",
    completedAt: "2026-01-01T11:00:00.000Z",
    totalMarks: 41,
    autoMarks: 26,
    manualMarks: 15,
    maximumMarks: 50,
    publishedAt: "2026-01-02T08:30:00.000Z",
    verificationUrl: "/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };
}

test("performance PDF paginates large candidate tables", async () => {
  const bytes = await buildPerformanceReportPdf(makePerformanceReport(80));
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1);
});

test("official candidate PDF embeds its verification reference", async () => {
  const bytes = await buildCandidateResultReportPdf(
    makeCandidateReport(),
    "https://evalify.example.test/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  assert.ok(
    document
      .getPage(0)
      .node.Resources()
      ?.toString()
      .includes("/XObject"),
    "the PDF page should contain the embedded QR image",
  );
});
