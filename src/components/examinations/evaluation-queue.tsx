"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { listExaminerEvaluations } from "@/lib/evaluations/service";

type EvaluationQueueItem = Awaited<
  ReturnType<typeof listExaminerEvaluations>
>[number];

type QueueStatus = EvaluationQueueItem["status"] | "ALL";

const statusLabels: Record<EvaluationQueueItem["status"], string> = {
  AUTO_GRADED: "Auto-graded",
  AWAITING_MANUAL: "Awaiting manual review",
  PARTIALLY_EVALUATED: "Partially evaluated",
  COMPLETED: "Ready to finalize",
  FINALIZED: "Finalized",
};

function isQueueStatus(value: string): value is QueueStatus {
  return value === "ALL" || Object.hasOwn(statusLabels, value);
}

function formatDate(value: string | null) {
  if (!value) return "Time unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function EvaluationQueue({
  evaluations,
}: {
  evaluations: EvaluationQueueItem[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QueueStatus>("ALL");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return evaluations.filter((evaluation) => {
      const matchesStatus = status === "ALL" || evaluation.status === status;
      const matchesSearch =
        !term ||
        `${evaluation.examTitle} ${evaluation.candidateEmail}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [evaluations, search, status]);
  const outstanding = evaluations.reduce(
    (total, evaluation) => total + evaluation.outstandingCount,
    0,
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Examiner workspace
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight sm:text-5xl">
            Evaluation queue
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Review submitted attempts, complete written marking, then finalize
            each score.
          </p>
        </div>
        <div className="grid grid-cols-2 border-y border-border sm:min-w-64">
          <div className="py-3 pr-5">
            <p className="text-xs text-muted-foreground">Submissions</p>
            <p className="mt-1 font-heading text-2xl tabular-nums">
              {evaluations.length}
            </p>
          </div>
          <div className="border-l border-border py-3 pl-5">
            <p className="text-xs text-muted-foreground">Written reviews left</p>
            <p className="mt-1 font-heading text-2xl tabular-nums">
              {outstanding}
            </p>
          </div>
        </div>
      </header>

      <section aria-label="Filter submissions" className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="relative block">
            <span className="sr-only">Search examinations and candidates</span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              className="min-h-11 w-full border border-border bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search examinations or candidates"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span className="sr-only">Filter by evaluation status</span>
            <select
              className="min-h-11 w-full border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              onChange={(event) => {
                if (isQueueStatus(event.target.value)) {
                  setStatus(event.target.value);
                }
              }}
              value={status}
            >
              <option value="ALL">All evaluation states</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {filtered.map((evaluation) => (
              <li key={evaluation.id}>
                <Link
                  className="group grid min-h-28 gap-4 py-5 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)_auto] sm:items-center sm:px-3"
                  href={`/examiner/evaluations/${evaluation.attemptId}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="truncate font-heading text-xl">
                        {evaluation.examTitle}
                      </h2>
                      <span className="border border-border px-2 py-1 text-xs font-medium">
                        {statusLabels[evaluation.status]}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {evaluation.candidateEmail}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {formatDate(evaluation.submittedAt)} UTC
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:text-right">
                    <span>
                      <strong className="block font-semibold tabular-nums">
                        {evaluation.totalMarks} / {evaluation.maximumMarks}
                      </strong>
                      <span className="text-muted-foreground">marks so far</span>
                    </span>
                    <span>
                      <strong className="block font-semibold tabular-nums">
                        {evaluation.outstandingCount}
                      </strong>
                      <span className="text-muted-foreground">
                        written left
                      </span>
                    </span>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="hidden size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-y border-border py-12">
            <h2 className="font-heading text-2xl">
              {evaluations.length === 0
                ? "No submitted attempts to evaluate"
                : "No submissions match these filters"}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              {evaluations.length === 0
                ? "Submitted attempts from examinations you manage will appear here. Objective answers are scored automatically."
                : "Change the search or status filter to see other submissions."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
