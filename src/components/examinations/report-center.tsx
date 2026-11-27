"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownToLine,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  FileCheck2,
  FileText,
  LockKeyhole,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type {
  getExaminerPerformanceReport,
  getExaminerQuestionAnalytics,
  listExaminerPerformanceReports,
  listExaminerReportExaminations,
  listExaminerReports,
} from "@/lib/reports/service";
import { ArrowDownToLine, CircleAlert, LockKeyhole, QrCode } from "lucide-react";
import type { listExaminerReports } from "@/lib/reports/service";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/feedback-provider";

type ExaminationList = Awaited<ReturnType<typeof listExaminerReportExaminations>>;
type Performance = Awaited<ReturnType<typeof getExaminerPerformanceReport>>;
type QuestionAnalytics = Awaited<ReturnType<typeof getExaminerQuestionAnalytics>>;
type CandidateReports = Awaited<ReturnType<typeof listExaminerReports>>;
type PerformanceReports = Awaited<
  ReturnType<typeof listExaminerPerformanceReports>
>;
type CandidateReport = CandidateReports[number]["results"][number];
type PerformanceReport = PerformanceReports[number];

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
  if (status === "COMPLETED") return "Ready to finalize";
  return "Evaluation not started";
}

function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function savePdf(response: Response, filename: string) {
  return response.blob().then((blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

export function ReportCenter({
  candidateReports,
  currentExaminerEmail,
  examinations,
  performance,
  performanceReports,
  questionAnalytics,
  selectedExaminationId,
}: {
  candidateReports: CandidateReports;
  currentExaminerEmail: string;
  examinations: ExaminationList;
  performance: Performance | null;
  performanceReports: PerformanceReports;
  questionAnalytics: QuestionAnalytics | null;
  selectedExaminationId: string | null;
}) {
  const router = useRouter();
  const [generatedReports, setGeneratedReports] = useState<
    { examinationId: string; report: PerformanceReport }[]
  >([]);
  const [busyAttempt, setBusyAttempt] = useState<string | null>(null);
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportToRevoke, setReportToRevoke] = useState<string | null>(null);
  const toast = useToast();

  const selectedCandidates =
    candidateReports.find((item) => item.id === selectedExaminationId)
      ?.results ?? [];
  const localReports = generatedReports
    .filter((entry) => entry.examinationId === selectedExaminationId)
    .map((entry) => entry.report);
  const localReportIds = new Set(localReports.map((report) => report.id));
  const reports = [
    ...localReports,
    ...performanceReports.filter((report) => !localReportIds.has(report.id)),
  ];

  async function generatePerformanceReport() {
    if (!selectedExaminationId) return;
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        "/api/v1/examiner/reports/performance",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examinationId: selectedExaminationId }),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        setError(
          body.error === "not_found"
            ? "This examination is no longer available."
            : "The PDF report could not be generated. No report was saved.",
        );
        return;
      }

      const id = response.headers.get("X-Evalify-Report-Id");
      const verificationToken = response.headers.get(
        "X-Evalify-Verification-Token",
      );
      const generatedAt = response.headers.get("X-Evalify-Generated-At");
      const reportStage = response.headers.get("X-Evalify-Report-Stage");
      if (!id || !verificationToken || !generatedAt || !reportStage) {
        throw new Error("report_metadata_missing");
      }
      await savePdf(response, `evalify-performance-${id}.pdf`);
      setGeneratedReports((current) => [
        {
          examinationId: selectedExaminationId,
          report: {
            id,
            generatedAt,
            verificationToken,
            generatedByEmail: currentExaminerEmail,
            reportStage:
              reportStage === "PUBLISHED_RESULTS"
                ? "PUBLISHED_RESULTS"
                : "INTERNAL_REVIEW",
            candidateCount: performance?.submittedCount ?? 0,
          },
        },
        ...current.filter((entry) => entry.report.id !== id),
      ]);
      setNotice("Report generated and saved to report history.");
    } catch {
      setError("The PDF report could not be generated. Try again.");
    } finally {
      setGenerating(false);
    }
  }

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

      router.refresh();
      setNotice("Official candidate report issued.");
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
      setNotice("");
      toast("Official result report issued.");
    } catch {
      setError("The report could not be issued. Try again.");
    } finally {
      setBusyAttempt(null);
    }
  }

  async function revokeReport(reportId: string) {
    setBusyReport(reportId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/examiner/reports/${reportId}`, {
        method: "POST",
      });
      if (!response.ok) {
        setError("The report could not be revoked.");
        return;
      }
      router.refresh();
      setNotice("Report revoked. Its verification page will show that status.");

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
      setNotice("");
      toast("Report revoked. Its verification page will show that status.");
    } catch {
      setError("The report could not be revoked. Try again.");
    } finally {
      setBusyReport(null);
    }
  }

  if (examinations.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeading />
        <div className="border-y border-border py-12">
          <h2 className="font-heading text-2xl">No examinations to report</h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            Examination analytics and saved reports will appear here after you
            create an examination.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="space-y-7">
        <PageHeading />
        <div className="flex flex-col gap-4 border-y border-border py-5 sm:flex-row sm:items-end sm:justify-between">
          <label className="grid gap-2 text-sm font-medium sm:min-w-80">
            Examination
            <select
              className="min-h-12 border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              onChange={(event) =>
                router.push(
                  `/examiner/reports?examinationId=${event.target.value}`,
                )
              }
              value={selectedExaminationId ?? ""}
            >
              {examinations.map((examination) => (
                <option key={examination.id} value={examination.id}>
                  {examination.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
            disabled={generating || !performance}
            onClick={() => void generatePerformanceReport()}
            type="button"
          >
            <ArrowDownToLine aria-hidden="true" className="size-4" />
            {generating ? "Generating PDF" : "Generate PDF report"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6 text-sm">
        {error ? (
          <p className="flex items-start gap-2 text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : notice ? (
          <p className="flex items-center gap-2 text-emerald-700">
            <CircleCheck aria-hidden="true" className="size-4" />
            {notice}
          </p>
        ) : null}
      </div>

      {performance ? (
        <>
          <section aria-labelledby="selected-examination-title" className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(performance.opensAt)} –{" "}
                  {formatDate(performance.closesAt)} UTC
                </p>
                <h2
                  className="mt-2 break-words font-heading text-3xl tracking-tight sm:text-4xl"
                  id="selected-examination-title"
                >
                  {performance.title}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm">
                <LockKeyhole aria-hidden="true" className="size-4 text-muted-foreground" />
                Examiner-only data
              </span>
            </div>

            <dl className="grid border-y border-border sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Enrolled candidates" value={performance.enrolledCount} />
              <Metric
                label="Submitted attempts"
                value={performance.submittedCount}
                detail={`${formatPercentage(performance.participationRate)} participation`}
              />
              <Metric
                label="Average score"
                value={formatPercentage(performance.averagePercentage)}
                detail={`Mean percentage · ${performance.finalizedCount} finalized results`}
              />
              <Metric
                label="Highest score"
                value={formatPercentage(performance.highestPercentage)}
                detail={
                  performance.highestMarks === null
                    ? "No finalized scores"
                    : `${performance.highestMarks} marks`
                }
              />
              <Metric
                label="Lowest score"
                value={formatPercentage(performance.lowestPercentage)}
                detail={
                  performance.lowestMarks === null
                    ? "No finalized scores"
                    : `${performance.lowestMarks} marks`
                }
              />
              <Metric
                label="Pass rate"
                value={
                  performance.passRate === null
                    ? "Not set"
                    : formatPercentage(performance.passRate)
                }
                detail="No passing threshold configured"
              />
            </dl>
          </section>

          <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div aria-labelledby="score-distribution-title">
              <div className="flex items-center gap-3">
                <ChartNoAxesCombined aria-hidden="true" className="size-5 text-primary" />
                <h2 className="font-heading text-2xl" id="score-distribution-title">
                  Finalized score distribution
                </h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Percentage bands include finalized results only. Objective
                correctness uses answered responses; written answers require
                examiner grading.
              </p>
              <div className="mt-6 space-y-4">
                {performance.scoreDistribution.map((band) => {
                  const width =
                    performance.finalizedCount === 0
                      ? 0
                      : (band.count / performance.finalizedCount) * 100;
                  return (
                    <div
                      className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm"
                      key={band.label}
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {band.label}
                      </span>
                      <div
                        aria-label={`${band.count} results in ${band.label}`}
                        className="h-3 bg-muted"
                        role="img"
                      >
                        <div
                          className="h-full bg-primary transition-[width]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-right tabular-nums">{band.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="border-l-2 border-primary pl-5">
              <div className="flex items-center gap-3">
                <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                <h2 className="font-heading text-2xl">Result state</h2>
              </div>
              <p className="mt-3 text-base font-medium">
                {performance.reportStage === "PUBLISHED_RESULTS"
                  ? "All submitted results are finalized and published."
                  : "Internal examiner review"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {performance.reportStage === "PUBLISHED_RESULTS"
                  ? "The report includes the published result state recorded at generation."
                  : "This view can include unpublished results and scores awaiting manual grading. It is not a candidate result report."}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Reports use persisted attempts. Incomplete evaluations do not
                contribute to finalized score statistics.
              </p>
            </aside>
          </section>

          <section aria-labelledby="question-analytics-title" className="space-y-5">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-2xl" id="question-analytics-title">
                Question response data
              </h2>
              <span className="text-sm text-muted-foreground">
                {questionAnalytics?.questions.length ?? 0} questions
              </span>
            </div>
            {questionAnalytics?.questions.length ? (
              <div className="divide-y divide-border border-y border-border">
                {questionAnalytics.questions.map((question, index) => {
                  const maxSelection = Math.max(
                    1,
                    ...question.options.map((option) => option.selectionCount),
                  );
                  return (
                    <article
                      className="grid gap-6 py-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(19rem,1.2fr)]"
                      key={`${question.id}-${question.type}`}
                    >
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Question {index + 1} ·{" "}
                          {question.type.replaceAll("_", " ")} ·{" "}
                          {question.marks} marks
                        </p>
                        <h3 className="mt-2 line-clamp-3 text-base font-medium leading-6">
                          {question.prompt}
                        </h3>
                        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <dt className="text-muted-foreground">Responses</dt>
                            <dd className="mt-1 font-semibold tabular-nums">
                              {question.responseCount}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Unanswered</dt>
                            <dd className="mt-1 font-semibold tabular-nums">
                              {question.unansweredCount}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              {question.correctRate === null ? "Correct rate" : "Correct"}
                            </dt>
                            <dd className="mt-1 font-semibold tabular-nums">
                              {question.correctRate === null
                                ? "—"
                                : formatPercentage(question.correctRate)}
                            </dd>
                          </div>
                        </dl>
                        {question.type === "WRITTEN" ? (
                          <p className="mt-3 text-sm text-muted-foreground">
                            Written responses require manual grading.
                          </p>
                        ) : null}
                      </div>
                      {question.options.length ? (
                        <div className="space-y-3">
                          {question.options.map((option) => (
                            <div
                              className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-3"
                              key={option.id}
                            >
                              <div className="min-w-0">
                                <div className="mb-1 flex justify-between gap-3 text-sm">
                                  <span className="truncate">{option.text}</span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {option.selectionCount}
                                  </span>
                                </div>
                                <div className="h-2 bg-muted">
                                  <div
                                    className="h-full bg-primary/80"
                                    style={{
                                      width: `${(option.selectionCount / maxSelection) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground">
                            Selection counts are based on submitted responses.
                          </p>
                        </div>
                      ) : (
                        <p className="self-center text-sm text-muted-foreground">
                          No objective answer options for this written question.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="border-y border-border py-8 text-base text-muted-foreground">
                Question response data will appear when candidates submit attempts.
              </p>
            )}
          </section>

          <section aria-labelledby="candidate-results-title" className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl" id="candidate-results-title">
                  Candidate performance
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Final scores appear only after grading is finalized.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedCandidates.length} submitted attempts
              </span>
            </div>
            {selectedCandidates.length ? (
              <div className="overflow-x-auto border-y border-border">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Candidate scores and publication state for {performance.title}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 text-left font-medium" scope="col">Candidate</th>
                      <th className="px-4 py-3 text-left font-medium" scope="col">Result state</th>
                      <th className="px-4 py-3 text-right font-medium" scope="col">Marks</th>
                      <th className="px-4 py-3 text-right font-medium" scope="col">Score</th>
                      <th className="py-3 pl-4 text-right font-medium" scope="col">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCandidates.map((result) => (
                      <tr className="border-b border-border last:border-0" key={result.attemptId}>
                        <td className="py-4 pr-4">
                          <p className="max-w-64 truncate font-medium">
                            {result.candidateEmail}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Completed {formatDate(result.completedAt)} UTC
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {evaluationLabel(result.evaluationStatus)}
                          {result.publishedAt ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Published {formatDate(result.publishedAt)} UTC
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums">
                          {result.totalMarks} / {result.maximumMarks}
                          {result.evaluationStatus !== "FINALIZED" ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {result.autoMarks} objective marks awarded
                              {" · "}
                              {result.manualMarks} manual marks awarded
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums">
                          {result.evaluationStatus === "FINALIZED"
                            ? formatPercentage(
                                Math.round(
                                  (result.totalMarks / result.maximumMarks) * 1000,
                                ) / 10,
                              )
                            : "Pending"}
                        </td>
                        <td className="py-4 pl-4 text-right">
                          {result.issuedReport?.status === "VALID" ? (
                            <div className="flex justify-end gap-3">
                              <a
                                className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline"
                                href={`/api/v1/examiner/reports/${result.issuedReport.id}/pdf`}
                              >
                                <ArrowDownToLine aria-hidden="true" className="size-4" />
                                Download
                              </a>
                              <button
                                className="min-h-11 px-2 text-destructive underline underline-offset-4 disabled:opacity-50"
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
                            </div>
                          ) : result.issuedReport?.status === "REVOKED" ? (
                            <span className="text-destructive">Revoked</span>
                          ) : result.publishedAt ? (
                            <button
                              className="min-h-11 border border-border px-3 font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                              disabled={busyAttempt === result.attemptId}
                              onClick={() => void issueReport(result.attemptId)}
                              type="button"
                            >
                              {busyAttempt === result.attemptId
                                ? "Issuing"
                                : "Issue result PDF"}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">
                              Publish result first
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="border-y border-border py-8 text-base text-muted-foreground">
                No candidates have submitted an attempt for this examination.
              </p>
            )}
          </section>

          <section aria-labelledby="report-history-title" className="space-y-5">
            <div className="flex items-center gap-3">
              <FileCheck2 aria-hidden="true" className="size-5 text-primary" />
              <h2 className="font-heading text-2xl" id="report-history-title">
                Report history
              </h2>
              <span className="text-sm text-muted-foreground">{reports.length}</span>
            </div>
            {reports.length ? (
              <ul className="divide-y divide-border border-y border-border">
                {reports.map((report: PerformanceReport) => (
                  <li
                    className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"
                    key={report.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                        <p className="font-medium">
                          {report.reportStage === "PUBLISHED_RESULTS"
                            ? "Published results report"
                            : "Internal examiner report"}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Generated {formatDate(report.generatedAt)} UTC by{" "}
                        {report.generatedByEmail}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {report.verificationToken}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        className="inline-flex min-h-11 items-center gap-2 border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted"
                        href={`/verify/${report.verificationToken}`}
                      >
                        <QrCode aria-hidden="true" className="size-4" />
                        Verify
                      </Link>
                      <a
                        className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover"
                        href={`/api/v1/examiner/reports/performance/${report.id}/pdf`}
                      >
                        <ArrowDownToLine aria-hidden="true" className="size-4" />
                        Download PDF
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-y border-border py-8 text-base text-muted-foreground">
                Generated examination reports will be saved here with their
                verification references.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function PageHeading() {
  return (
    <header className="border-b border-border pb-7">
      <p className="text-sm font-medium text-muted-foreground">
        Examiner workspace
      </p>
      <h1 className="mt-2 font-heading text-4xl tracking-tight sm:text-5xl">
        Reports and analytics
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Review completed attempts, question responses and finalized scores.
        Generate examination reports from saved records.
      </p>
    </header>
  );
}

function Metric({
  detail,
  label,
  value,
}: {
  detail?: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border-b border-border py-5 sm:px-5 lg:py-6 [&:nth-child(3n+1)]:sm:pl-0 [&:nth-child(3n)]:sm:pr-0 sm:odd:border-r lg:border-b">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-heading text-3xl tabular-nums">{value}</dd>
      {detail ? (
        <dd className="mt-1 text-sm text-muted-foreground">{detail}</dd>
      ) : null}
                              className="min-h-11 px-3 text-sm font-medium text-destructive underline underline-offset-4 disabled:opacity-50"
                              disabled={busyReport === result.issuedReport.id}
                              onClick={() =>
                                setReportToRevoke(result.issuedReport!.id)
                              }
                              type="button"
                            >
                              {busyReport === result.issuedReport.id
                                ? <Spinner label="Revoking" />
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
                              ? <Spinner label="Issuing report" />
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
      <ConfirmDialog
        confirmLabel="Revoke report"
        destructive
        description="The report's verification status will change to revoked. This action cannot be undone."
        onConfirm={() => {
          const reportId = reportToRevoke;
          setReportToRevoke(null);
          if (reportId) void revokeReport(reportId);
        }}
        onOpenChange={(open) => {
          if (!open) setReportToRevoke(null);
        }}
        open={reportToRevoke !== null}
        pending={busyReport !== null}
        title="Revoke this report?"
      />
    </div>
  );
}
