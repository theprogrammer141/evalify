"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, CircleAlert, LockKeyhole, QrCode } from "lucide-react";
import type { listExaminerReports } from "@/lib/reports/service";

type ExaminationReports = Awaited<ReturnType<typeof listExaminerReports>>;
type ExaminationReport = ExaminationReports[number];
type CandidateReport = ExaminationReport["results"][number];

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function evaluationLabel(status: CandidateReport["evaluationStatus"]) {
  if (status === "FINALIZED") return "Finalized";
  if (status === "AUTO_GRADED") return "Auto-graded";
  if (status === "AWAITING_MANUAL") return "Awaiting review";
  if (status === "PARTIALLY_EVALUATED") return "Partially evaluated";
  return "Ready to finalize";
}

export function ReportCenter({
  initialExaminations,
}: {
  initialExaminations: ExaminationReports;
}) {
  const [examinations, setExaminations] = useState(initialExaminations);
  const [busyAttempt, setBusyAttempt] = useState<string | null>(null);
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function issueReport(attemptId: string) {
    setBusyAttempt(attemptId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/examiner/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.error === "not_published"
            ? "Publish the candidate result before issuing an official report."
            : body.error === "report_revoked"
              ? "This report was revoked and cannot be reissued."
              : "The report could not be issued.",
        );
        return;
      }

      const report = body.report as NonNullable<CandidateReport["issuedReport"]>;
      setExaminations((current) =>
        current.map((examination) => ({
          ...examination,
          results: examination.results.map((result) =>
            result.attemptId === attemptId
              ? { ...result, issuedReport: report }
              : result,
          ),
        })),
      );
      setNotice("Official result report issued.");
    } catch {
      setError("The report could not be issued. Try again.");
    } finally {
      setBusyAttempt(null);
    }
  }

  async function revokeReport(reportId: string) {
    if (!window.confirm("Revoke this report? Its verification status will change to revoked.")) {
      return;
    }
    setBusyReport(reportId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/examiner/reports/${reportId}`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) {
        setError("The report could not be revoked.");
        return;
      }

      setExaminations((current) =>
        current.map((examination) => ({
          ...examination,
          results: examination.results.map((result) =>
            result.issuedReport?.id === reportId
              ? { ...result, issuedReport: body.report }
              : result,
          ),
        })),
      );
      setNotice("Report revoked. Its verification page will show that status.");
    } catch {
      setError("The report could not be revoked. Try again.");
    } finally {
      setBusyReport(null);
    }
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-medium text-muted-foreground">
          Examiner workspace
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-heading text-4xl tracking-tight sm:text-5xl">
              Reports and results
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Preview examination performance, publish reviewed results, and issue
              candidate reports with public verification.
            </p>
          </div>
          <div className="flex items-center gap-2 border-y border-border px-4 py-3 text-sm text-muted-foreground">
            <LockKeyhole aria-hidden="true" className="size-4" />
            Reports are scoped to examinations you manage
          </div>
        </div>
      </header>

      <div aria-live="polite" className="min-h-6 text-sm">
        {error ? (
          <p className="flex items-start gap-2 text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : notice ? (
          <p className="text-emerald-700">{notice}</p>
        ) : null}
      </div>

      {examinations.length ? (
        <div className="space-y-12">
          {examinations.map((examination) => {
            const finalized = examination.results.filter(
              (result) => result.evaluationStatus === "FINALIZED",
            );
            const average =
              finalized.length === 0
                ? null
                : Math.round(
                    (finalized.reduce(
                      (sum, result) =>
                        sum + (result.totalMarks / result.maximumMarks) * 100,
                      0,
                    ) /
                      finalized.length) *
                      10,
                  ) / 10;

            return (
              <section
                aria-labelledby={`exam-${examination.id}`}
                className="space-y-5"
                key={examination.id}
              >
                <header className="flex flex-col justify-between gap-5 border-b border-border pb-5 sm:flex-row sm:items-end">
                  <div className="min-w-0">
                    <h2
                      className="break-words font-heading text-2xl sm:text-3xl"
                      id={`exam-${examination.id}`}
                    >
                      {examination.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {examination.results.length} completed attempts ·{" "}
                      {finalized.length} finalized results
                      {average === null ? "" : ` · ${average}% average`}
                    </p>
                  </div>
                  <a
                    className="inline-flex min-h-11 w-fit items-center justify-center gap-2 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={`/api/v1/examiner/reports/performance?examinationId=${examination.id}`}
                  >
                    <ArrowDownToLine aria-hidden="true" className="size-4" />
                    Download preview
                  </a>
                </header>

                <ul className="divide-y divide-border border-y border-border">
                  {examination.results.map((result) => (
                    <li
                      className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(11rem,0.7fr)_auto]"
                      key={result.attemptId}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {result.candidateEmail}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Completed {formatDate(result.completedAt)} UTC
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {evaluationLabel(result.evaluationStatus)}
                          {result.publishedAt
                            ? ` · Published ${formatDate(result.publishedAt)} UTC`
                            : ""}
                        </p>
                      </div>

                      <p className="text-sm tabular-nums lg:text-right">
                        {result.evaluationStatus === "FINALIZED"
                          ? `${result.totalMarks} / ${result.maximumMarks} marks`
                          : `${result.totalMarks} / ${result.maximumMarks} marks so far`}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {result.issuedReport?.status === "VALID" ? (
                          <>
                            <a
                              className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              href={`/api/v1/examiner/reports/${result.issuedReport.id}/pdf`}
                            >
                              <ArrowDownToLine aria-hidden="true" className="size-4" />
                              Download issued PDF
                            </a>
                            <Link
                              className="inline-flex min-h-11 items-center gap-2 border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              href={`/verify/${result.issuedReport.verificationToken}`}
                            >
                              <QrCode aria-hidden="true" className="size-4" />
                              Verify
                            </Link>
                            <button
                              className="min-h-11 px-3 text-sm font-medium text-destructive underline underline-offset-4 disabled:opacity-50"
                              disabled={busyReport === result.issuedReport.id}
                              onClick={() =>
                                void revokeReport(result.issuedReport!.id)
                              }
                              type="button"
                            >
                              {busyReport === result.issuedReport.id
                                ? "Revoking"
                                : "Revoke"}
                            </button>
                          </>
                        ) : result.issuedReport?.status === "REVOKED" ? (
                          <span className="border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive">
                            Report revoked
                          </span>
                        ) : result.publishedAt ? (
                          <button
                            className="inline-flex min-h-11 items-center justify-center border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={busyAttempt === result.attemptId}
                            onClick={() => void issueReport(result.attemptId)}
                            type="button"
                          >
                            {busyAttempt === result.attemptId
                              ? "Issuing report"
                              : "Issue candidate report"}
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Publish before issuing
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="border-y border-border py-12">
          <h2 className="font-heading text-2xl">No completed attempts yet</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Examination reports will appear once candidates submit attempts and
            those submissions enter the evaluation workflow.
          </p>
        </div>
      )}
    </div>
  );
}
