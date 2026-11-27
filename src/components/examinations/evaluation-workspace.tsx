"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  LockKeyhole,
  Save,
} from "lucide-react";
import type { AttemptAnswerValue } from "@/lib/attempts/types";
import type { getExaminerEvaluation } from "@/lib/evaluations/service";

type Evaluation = Awaited<ReturnType<typeof getExaminerEvaluation>>;
type QuestionEvaluation = Evaluation["questions"][number];
type QuestionDraft = { awardedMarks: string; feedback: string };

const statusLabels: Record<Evaluation["status"], string> = {
  AUTO_GRADED: "Auto-graded",
  AWAITING_MANUAL: "Awaiting manual review",
  PARTIALLY_EVALUATED: "Partially evaluated",
  COMPLETED: "Ready to finalize",
  FINALIZED: "Finalized",
};

function formatDate(value: string | null) {
  if (!value) return "Time unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function draftValues(questions: QuestionEvaluation[]) {
  const drafts: Record<string, QuestionDraft> = {};
  for (const question of questions) {
    drafts[question.id] = {
      awardedMarks:
        question.awardedMarks === null ? "" : String(question.awardedMarks),
      feedback: question.feedback,
    };
  }
  return drafts;
}

function responseText(
  answer: AttemptAnswerValue | null,
  question: QuestionEvaluation,
) {
  if (question.type === "WRITTEN") {
    if (answer?.kind !== "written" || !answer.text.trim()) {
      return "No written response was submitted.";
    }
    return answer.text;
  }
  if (!answer || answer.kind === "written") return "No answer was submitted.";

  const selectedIds =
    answer.kind === "single" ? [answer.optionId] : answer.optionIds;
  const selected = question.options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.text);
  return selected.length > 0 ? selected.join(", ") : "No answer was submitted.";
}

function actionLabel(action: Evaluation["history"][number]["action"]) {
  switch (action) {
    case "EVALUATION_CREATED":
      return "Automatic evaluation created";
    case "MARKS_UPDATED":
      return "Manual marks or feedback changed";
    case "FINALIZED":
      return "Evaluation finalized";
  }
}

function stateNumber(state: Record<string, unknown> | null, key: string) {
  return typeof state?.[key] === "number" ? state[key] : null;
}

export function EvaluationWorkspace({
  initialEvaluation,
}: {
  initialEvaluation: Evaluation;
}) {
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [drafts, setDrafts] = useState(() =>
    draftValues(initialEvaluation.questions),
  );
  const [savingQuestion, setSavingQuestion] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const isFinalized = evaluation.status === "FINALIZED";
  const isPublished = evaluation.publishedAt !== null;
  const canFinalize =
    evaluation.status === "AUTO_GRADED" ||
    evaluation.status === "COMPLETED";

  async function reloadEvaluation() {
    const response = await fetch(
      `/api/v1/examiner/evaluations/${evaluation.attemptId}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("refresh_failed");
    const result = await response.json();
    setEvaluation(result.evaluation as Evaluation);
    setDrafts(draftValues(result.evaluation.questions));
  }

  async function saveGrade(question: QuestionEvaluation) {
    const draft = drafts[question.id];
    if (!draft || draft.awardedMarks.trim() === "") {
      setError("Enter an awarded mark before saving.");
      return;
    }

    setSavingQuestion(question.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/examiner/evaluations/${evaluation.attemptId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: question.id,
            expectedRevision: evaluation.revision,
            awardedMarks: Number(draft.awardedMarks),
            feedback: draft.feedback,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "revision_conflict") {
          await reloadEvaluation();
          setError(
            "This evaluation changed elsewhere. The latest saved version is shown; review it before making another change.",
          );
        } else if (result.error === "invalid_marks") {
          setError(`Marks must be between 0 and ${question.marks}.`);
        } else if (result.error === "finalized") {
          await reloadEvaluation();
          setError("This evaluation has been finalized and can no longer change.");
        } else {
          setError("The question evaluation could not be saved.");
        }
        return;
      }

      setEvaluation(result.evaluation as Evaluation);
      setDrafts(draftValues(result.evaluation.questions));
      setNotice("Marks and feedback saved.");
    } catch {
      setError("The question evaluation could not be saved. Try again.");
    } finally {
      setSavingQuestion(null);
    }
  }

  async function finalize() {
    if (!window.confirm("Finalize this evaluation? It cannot be edited afterward.")) {
      return;
    }
    setFinalizing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/examiner/evaluations/${evaluation.attemptId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedRevision: evaluation.revision }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "revision_conflict") {
          await reloadEvaluation();
          setError(
            "This evaluation changed elsewhere. The latest saved version is shown; review it before finalizing.",
          );
        } else if (result.error === "evaluation_incomplete") {
          setError("Complete every written question before finalizing.");
        } else {
          setError("The evaluation could not be finalized.");
        }
        return;
      }
      setEvaluation(result.evaluation as Evaluation);
      setDrafts(draftValues(result.evaluation.questions));
      setNotice("Evaluation finalized. Marks and feedback are now locked.");
    } catch {
      setError("The evaluation could not be finalized. Try again.");
    } finally {
      setFinalizing(false);
    }
  }

  async function publish() {
    if (
      !window.confirm(
        "Publish this finalized result? The candidate will be able to access issued reports for it.",
      )
    ) {
      return;
    }

    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v1/examiner/evaluations/${evaluation.attemptId}/publish`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error === "not_finalized"
            ? "Finalize this evaluation before publishing the result."
            : "The result could not be published.",
        );
        return;
      }

      setEvaluation(result.evaluation as Evaluation);
      setNotice("Result published. The candidate can now receive an official report.");
    } catch {
      setError("The result could not be published. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-9">
      <header className="border-b border-border pb-7">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          href="/examiner/evaluations"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Evaluation queue
        </Link>
        <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {evaluation.candidateEmail} · Submitted{" "}
              {formatDate(evaluation.submittedAt)} UTC
            </p>
            <h1 className="mt-2 break-words font-heading text-3xl tracking-tight sm:text-4xl">
              {evaluation.examTitle}
            </h1>
          </div>
          <span className="inline-flex min-h-9 w-fit items-center gap-2 border border-border px-3 text-sm font-medium">
            {isFinalized ? (
              <LockKeyhole aria-hidden="true" className="size-4" />
            ) : null}
            {statusLabels[evaluation.status]}
          </span>
        </div>
      </header>

      <section
        aria-label="Score summary"
        className="grid border-y border-border sm:grid-cols-3"
      >
        <div className="border-b border-border py-4 sm:border-b-0 sm:pr-7">
          <p className="text-sm text-muted-foreground">Awarded so far</p>
          <p className="mt-1 font-heading text-3xl tabular-nums">
            {evaluation.totalMarks}
            <span className="ml-1 text-base text-muted-foreground">
              / {evaluation.maximumMarks}
            </span>
          </p>
        </div>
        <div className="border-b border-border py-4 sm:border-b-0 sm:border-l sm:px-7">
          <p className="text-sm text-muted-foreground">Automatic marks</p>
          <p className="mt-1 font-heading text-2xl tabular-nums">
            {evaluation.autoMarks} / {evaluation.autoMaximumMarks}
          </p>
        </div>
        <div className="py-4 sm:border-l sm:pl-7">
          <p className="text-sm text-muted-foreground">Manual marks</p>
          <p className="mt-1 font-heading text-2xl tabular-nums">
            {evaluation.manualMarks} / {evaluation.manualMaximumMarks}
          </p>
        </div>
      </section>

      {evaluation.instructions ? (
        <details className="border border-border bg-card px-5 py-4">
          <summary className="min-h-8 cursor-pointer content-center text-sm font-semibold">
            Examination instructions
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {evaluation.instructions}
          </p>
        </details>
      ) : null}

      <section aria-labelledby="questions-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {evaluation.questions.length} questions
            </p>
            <h2
              className="mt-1 font-heading text-2xl"
              id="questions-heading"
            >
              Submission and marking
            </h2>
          </div>
          {isFinalized ? (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Check aria-hidden="true" className="size-4" />
              Finalized {formatDate(evaluation.finalizedAt)} UTC
            </p>
          ) : null}
          {isPublished ? (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Check aria-hidden="true" className="size-4" />
              Published {formatDate(evaluation.publishedAt)} UTC
            </p>
          ) : null}
        </div>

        <ol className="divide-y divide-border border-y border-border">
          {evaluation.questions.map((question, index) => {
            const draft = drafts[question.id];
            const manual = question.source === "MANUAL";
            return (
              <li className="py-7" key={question.id}>
                <article className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-muted-foreground">
                        Question {index + 1}
                      </p>
                      <span className="border border-border px-2 py-1 text-xs font-medium">
                        {question.marks}{" "}
                        {question.marks === 1 ? "mark" : "marks"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {manual
                          ? question.awardedMarks === null
                            ? "Awaiting manual review"
                            : "Manually evaluated"
                          : "Automatically graded"}
                      </span>
                    </div>
                    <h3 className="mt-3 whitespace-pre-wrap font-heading text-xl leading-7">
                      {question.prompt}
                    </h3>
                    <div className="mt-5 border-l-2 border-border pl-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Candidate response
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {responseText(question.answer, question)}
                      </p>
                    </div>
                    {!manual ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Automatically awarded{" "}
                        <strong className="font-semibold text-foreground">
                          {question.awardedMarks} / {question.marks}
                        </strong>
                        . Objective answers use the published examination key.
                      </p>
                    ) : null}
                  </div>

                  {manual ? (
                    <div className="space-y-4 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      {question.markingGuidelines ? (
                        <div className="bg-muted/50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Marking guidelines
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                            {question.markingGuidelines}
                          </p>
                        </div>
                      ) : null}
                      <label className="block text-sm font-medium">
                        Awarded marks (0–{question.marks})
                        <input
                          className="mt-2 min-h-11 w-full border border-border bg-background px-3 text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:bg-muted"
                          disabled={isFinalized || savingQuestion !== null}
                          max={question.marks}
                          min={0}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [question.id]: {
                                ...current[question.id],
                                awardedMarks: event.target.value,
                              },
                            }))
                          }
                          required
                          step={1}
                          type="number"
                          value={draft?.awardedMarks ?? ""}
                        />
                      </label>
                      <label className="block text-sm font-medium">
                        Feedback for this response
                        <textarea
                          className="mt-2 min-h-28 w-full resize-y border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:bg-muted"
                          disabled={isFinalized || savingQuestion !== null}
                          maxLength={8000}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [question.id]: {
                                ...current[question.id],
                                feedback: event.target.value,
                              },
                            }))
                          }
                          rows={3}
                          value={draft?.feedback ?? ""}
                        />
                      </label>
                      {question.gradedAt ? (
                        <p className="text-xs text-muted-foreground">
                          Last saved {formatDate(question.gradedAt)} UTC
                        </p>
                      ) : null}
                      <button
                        className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          isFinalized ||
                          savingQuestion !== null ||
                          !draft?.awardedMarks
                        }
                        onClick={() => void saveGrade(question)}
                        type="button"
                      >
                        <Save aria-hidden="true" className="size-4" />
                        {savingQuestion === question.id
                          ? "Saving"
                          : "Save marks and feedback"}
                      </button>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-labelledby="history-heading"
        className="border-t border-border pt-7"
      >
        <h2 className="font-heading text-2xl" id="history-heading">
          Evaluation history
        </h2>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {evaluation.history.map((entry) => {
            const beforeMarks = stateNumber(entry.beforeState, "awardedMarks");
            const afterMarks = stateNumber(entry.afterState, "awardedMarks");
            const changedFeedback =
              entry.beforeState?.feedback !== entry.afterState.feedback;
            const beforeFeedback =
              typeof entry.beforeState?.feedback === "string"
                ? entry.beforeState.feedback
                : "No feedback saved";
            const afterFeedback =
              typeof entry.afterState.feedback === "string"
                ? entry.afterState.feedback
                : "No feedback saved";
            const afterTotal = stateNumber(entry.afterState, "totalMarks");
            const questionNumber = entry.questionId
              ? evaluation.questions.findIndex(
                  (question) => question.id === entry.questionId,
                ) + 1
              : null;
            return (
              <li className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto]" key={entry.id}>
                <div>
                  <p className="text-sm font-semibold">
                    {actionLabel(entry.action)}
                    {questionNumber ? ` · Question ${questionNumber}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.actorEmail}
                    {beforeMarks !== null && afterMarks !== null
                      ? ` · ${beforeMarks} → ${afterMarks} marks`
                      : ""}
                    {changedFeedback ? " · Feedback updated" : ""}
                    {typeof entry.afterState.status === "string"
                      ? ` · ${entry.afterState.status.replaceAll("_", " ").toLowerCase()}`
                      : ""}
                    {entry.action === "FINALIZED" && afterTotal !== null
                      ? ` · Final score ${afterTotal} / ${evaluation.maximumMarks}`
                      : ""}
                  </p>
                  {entry.action === "MARKS_UPDATED" ? (
                    <details className="mt-2 text-sm">
                      <summary className="min-h-8 w-fit cursor-pointer content-center font-medium underline underline-offset-4">
                        View recorded change
                      </summary>
                      <div className="mt-2 grid gap-3 border-l-2 border-border pl-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Before
                          </p>
                          <p className="mt-1">
                            {beforeMarks === null
                              ? "Not evaluated"
                              : `${beforeMarks} marks`}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {beforeFeedback}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            After
                          </p>
                          <p className="mt-1">
                            {afterMarks === null
                              ? "Not evaluated"
                              : `${afterMarks} marks`}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {afterFeedback}
                          </p>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={entry.createdAt}
                >
                  {formatDate(entry.createdAt)} UTC
                </time>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="min-h-6 text-sm">
          {error ? (
            <p className="flex items-start gap-2 text-destructive">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : notice ? (
            <p className="text-emerald-700">{notice}</p>
          ) : !canFinalize && !isFinalized ? (
            <p className="text-muted-foreground">
              Complete every manual review before finalizing this evaluation.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {isFinalized && !isPublished ? (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={publishing}
              onClick={() => void publish()}
              type="button"
            >
              {publishing ? "Publishing result" : "Publish result"}
            </button>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canFinalize || finalizing || savingQuestion !== null}
            onClick={() => void finalize()}
            type="button"
          >
            {isFinalized ? (
              <>
                <LockKeyhole aria-hidden="true" className="size-4" />
                Evaluation finalized
              </>
            ) : finalizing ? (
              "Finalizing"
            ) : (
              "Finalize evaluation"
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
