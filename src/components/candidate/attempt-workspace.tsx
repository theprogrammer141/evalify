"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Flag,
  Save,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  AttemptAnswerValue,
  CandidateAttempt,
  CandidateQuestion,
} from "@/lib/attempts/types";

function subscribeToConnectivity(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getConnectivitySnapshot() {
  return navigator.onLine;
}

type SyncState = "saved" | "pending" | "failed";
type QuestionProgress = Pick<
  CandidateQuestion,
  "answer" | "markedForReview" | "revision"
> & {
  sync: SyncState;
};
type ProgressMap = Record<string, QuestionProgress>;

function toProgressMap(attempt: CandidateAttempt): ProgressMap {
  return Object.fromEntries(
    attempt.questions.map((question) => [
      question.id,
      {
        answer: question.answer,
        markedForReview: question.markedForReview,
        revision: question.revision,
        sync: "saved" as const,
      },
    ]),
  );
}

function hasAnswer(answer: AttemptAnswerValue | null): boolean {
  if (!answer) return false;
  if (answer.kind === "written") return answer.text.trim().length > 0;
  if (answer.kind === "multiple") return answer.optionIds.length > 0;
  return true;
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function questionTypeLabel(question: CandidateQuestion): string {
  if (question.type === "SINGLE_CHOICE") return "Select one answer";
  if (question.type === "MULTIPLE_SELECT") return "Select all that apply";
  return "Written response";
}

export function AttemptWorkspace({
  initialAttempt,
}: {
  initialAttempt: CandidateAttempt;
}) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [progress, setProgress] = useState<ProgressMap>(() =>
    toProgressMap(initialAttempt),
  );
  const progressRef = useRef(progress);
  const dirtyRef = useRef(new Map<string, QuestionProgress>());
  const timersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    () => true,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(
      0,
      Date.parse(initialAttempt.expiresAt) -
        Date.parse(initialAttempt.serverNow),
    ),
  );
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const submitDialogRef = useRef<HTMLElement | null>(null);
  const [scratchpad, setScratchpad] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const questions = attempt.questions;
  const currentQuestion = questions[currentIndex];
  const currentProgress = currentQuestion
    ? progress[currentQuestion.id]
    : undefined;
  const answeredCount = questions.filter((question) =>
    hasAnswer(progress[question.id]?.answer ?? null),
  ).length;
  const reviewCount = questions.filter(
    (question) => progress[question.id]?.markedForReview,
  ).length;
  const hasPending = Object.values(progress).some(
    (state) => state.sync === "pending",
  );
  const hasFailed = Object.values(progress).some(
    (state) => state.sync === "failed",
  );
  const isActive = attempt.status === "IN_PROGRESS";
  const isLowTime = remainingMs > 0 && remainingMs <= 5 * 60_000;

  const replaceProgress = useCallback((next: ProgressMap) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  const applyAttemptState = useCallback(
    (nextAttempt: CandidateAttempt) => {
      setAttempt(nextAttempt);
      replaceProgress(toProgressMap(nextAttempt));
      dirtyRef.current.clear();
      setMessage(null);
    },
    [replaceProgress],
  );

  const reconcileRef = useRef<() => Promise<void>>(async () => undefined);

  const persistAnswer = useCallback(
    async (questionId: string, value: QuestionProgress) => {
      if (!navigator.onLine || !isActive) return false;
      const currentDirty = dirtyRef.current.get(questionId);
      if (!currentDirty || currentDirty.revision !== value.revision) return true;

      try {
        const response = await fetch(
          `/api/v1/candidate/attempts/${attempt.id}/answers/${questionId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revision: value.revision,
              answer: value.answer,
              markedForReview: value.markedForReview,
            }),
          },
        );

        if (response.status === 409) {
          setMessage(
            "The server has newer confirmed progress. Refreshing this attempt state.",
          );
          void reconcileRef.current();
          return false;
        }
        if (!response.ok) {
          throw new Error("The answer save was rejected.");
        }

        const result = (await response.json()) as {
          answer: {
            questionId: string;
            answer: AttemptAnswerValue | null;
            markedForReview: boolean;
            revision: number;
          };
        };
        const latest = progressRef.current[questionId];
        if (latest?.revision === value.revision) {
          retryCountRef.current = 0;
          const next = {
            ...progressRef.current,
            [questionId]: {
              answer: result.answer.answer,
              markedForReview: result.answer.markedForReview,
              revision: result.answer.revision,
              sync: "saved" as const,
            },
          };
          dirtyRef.current.delete(questionId);
          replaceProgress(next);
        }
        return true;
      } catch {
        const latest = progressRef.current[questionId];
        if (latest?.revision === value.revision) {
          replaceProgress({
            ...progressRef.current,
            [questionId]: { ...latest, sync: "failed" },
          });
        }
        if (navigator.onLine && retryCountRef.current === 0) {
          retryCountRef.current = 1;
          retryTimerRef.current = setTimeout(() => {
            void reconcileRef.current();
            retryTimerRef.current = null;
          }, 1200);
        }
        return false;
      }
    },
    [attempt.id, isActive, replaceProgress],
  );

  const reconcile = useCallback(async () => {
    if (!navigator.onLine || !isActive) return;
    try {
      const response = await fetch(
        `/api/v1/candidate/attempts/${attempt.id}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not reconcile attempt state.");
      const result = (await response.json()) as { attempt: CandidateAttempt };
      const serverAttempt = result.attempt;
      if (serverAttempt.status !== "IN_PROGRESS") {
        applyAttemptState(serverAttempt);
        return;
      }

      const serverProgress = toProgressMap(serverAttempt);
      const latest = { ...serverProgress };
      const retry: Array<[string, QuestionProgress]> = [];

      for (const [questionId, local] of dirtyRef.current) {
        const confirmed = serverProgress[questionId];
        if (confirmed && local.revision > confirmed.revision) {
          latest[questionId] = { ...local, sync: "pending" };
          retry.push([questionId, local]);
        } else {
          dirtyRef.current.delete(questionId);
        }
      }

      setAttempt(serverAttempt);
      replaceProgress(latest);
      setMessage(null);
      await Promise.all(
        retry.map(([questionId, value]) => persistAnswer(questionId, value)),
      );
    } catch {
      setMessage(
        "Could not synchronize with the server. Unconfirmed changes are not guaranteed to survive a refresh or device failure.",
      );
    }
  }, [
    applyAttemptState,
    attempt.id,
    isActive,
    persistAnswer,
    replaceProgress,
  ]);

  useEffect(() => {
    reconcileRef.current = reconcile;
  }, [reconcile]);

  const changeQuestionState = useCallback(
    (
      questionId: string,
      change: (current: QuestionProgress) => Pick<
        QuestionProgress,
        "answer" | "markedForReview"
      >,
    ) => {
      if (!isActive) return;
      const current = progressRef.current[questionId];
      if (!current) return;
      const changed = change(current);
      const nextState: QuestionProgress = {
        ...current,
        ...changed,
        revision: current.revision + 1,
        sync: "pending",
      };
      const nextProgress = {
        ...progressRef.current,
        [questionId]: nextState,
      };
      dirtyRef.current.set(questionId, nextState);
      replaceProgress(nextProgress);
      setMessage(null);

      const previousTimer = timersRef.current.get(questionId);
      if (previousTimer) clearTimeout(previousTimer);
      timersRef.current.set(
        questionId,
        setTimeout(() => {
          void persistAnswer(questionId, nextState);
          timersRef.current.delete(questionId);
        }, 350),
      );
    },
    [isActive, persistAnswer, replaceProgress],
  );

  const finalize = useCallback(
    async (flushPending: boolean) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setMessage(null);
      try {
        if (flushPending && navigator.onLine) {
          const pending = [...dirtyRef.current.entries()];
          await Promise.all(
            pending.map(([questionId, value]) =>
              persistAnswer(questionId, value),
            ),
          );
        }

        const response = await fetch(
          `/api/v1/candidate/attempts/${attempt.id}/submit`,
          { method: "POST" },
        );
        const result = (await response.json()) as {
          attempt?: CandidateAttempt;
        };
        if (!response.ok || !result.attempt) {
          throw new Error("The server could not finalize this attempt.");
        }
        applyAttemptState(result.attempt);
        setSubmitDialogOpen(false);
      } catch {
        setMessage(
          "Submission is not confirmed. Stay on this page and retry when you are connected.",
        );
        if (navigator.onLine && retryCountRef.current === 0) {
          retryCountRef.current = 1;
          retryTimerRef.current = setTimeout(() => {
            void reconcileRef.current();
            retryTimerRef.current = null;
          }, 1200);
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [applyAttemptState, attempt.id, persistAnswer],
  );

  useEffect(() => {
    function onOnline() {
      retryCountRef.current = 0;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      void reconcileRef.current();
    }
    window.addEventListener("online", onOnline);
    const timers = timersRef.current;
    return () => {
      window.removeEventListener("online", onOnline);
      for (const timer of timers.values()) clearTimeout(timer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const initialRemaining = Math.max(
      0,
      Date.parse(attempt.expiresAt) - Date.parse(attempt.serverNow),
    );
    const startedAt = performance.now();
    let expiryRequested = false;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        initialRemaining - (performance.now() - startedAt),
      );
      setRemainingMs(remaining);
      if (remaining === 0 && !expiryRequested) {
        expiryRequested = true;
        void finalize(false);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [attempt.expiresAt, attempt.serverNow, finalize, isActive]);

  useEffect(() => {
    if (!submitDialogOpen) return;
    const dialog = submitDialogRef.current;
    if (!dialog) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const getButtons = () =>
      Array.from(
        dialog.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ),
      );
    getButtons()[0]?.focus();

    function trapFocus(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) {
        setSubmitDialogOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = getButtons();
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previousFocus?.focus();
    };
  }, [submitDialogOpen]);

  useEffect(() => {
    if (isActive) return;
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, [isActive]);

  const statusText = !online
    ? "Offline — changes may not reach the server"
    : hasFailed
      ? "Some changes failed to save"
      : hasPending
        ? "Saving changes…"
        : "All changes saved";

  const progressSummary = useMemo(
    () => `${answeredCount} of ${questions.length} answered`,
    [answeredCount, questions.length],
  );

  if (!currentQuestion || !currentProgress) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-background p-8">
        <h1 className="font-heading text-2xl font-semibold">
          Attempt data is unavailable
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Return to your examinations and reopen this attempt. Contact your
          examination administrator if the problem continues.
        </p>
      </div>
    );
  }

  return (
    <section className="py-2 sm:py-4">
      <div className="mb-6 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/candidate"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Your examinations
          </Link>
          <p className="mt-5 text-sm font-medium text-primary">
            Examination attempt
          </p>
          <h1 className="mt-2 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {attempt.examTitle}
          </h1>
        </div>
        <div className="flex items-center justify-between gap-5 rounded-xl border border-border bg-background px-4 py-3 sm:min-w-64">
          <div className="flex items-center gap-3">
            <Clock3
              aria-hidden="true"
              className={`size-5 ${isLowTime ? "text-destructive" : "text-muted-foreground"}`}
            />
            <div>
              <p className="text-sm text-muted-foreground">
                {isActive ? "Time remaining" : "Attempt status"}
              </p>
              {!isActive && (
                <p className="text-base font-semibold">
                  {attempt.status === "SUBMITTED" ? "Submitted" : "Time expired"}
                </p>
              )}
            </div>
          </div>
          {isActive && (
            <div className="text-right">
              <output
                aria-label={`Time remaining ${formatTime(remainingMs)}`}
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  isLowTime ? "text-destructive" : "text-foreground"
                }`}
                role="timer"
              >
                {formatTime(remainingMs)}
              </output>
              {isLowTime && (
                <p className="text-xs font-medium text-destructive">
                  Less than five minutes
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {attempt.status !== "IN_PROGRESS" && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-4 ${
            attempt.status === "SUBMITTED"
              ? "border-success/30 bg-success/5"
              : "border-warning/30 bg-warning/5"
          }`}
          role="status"
        >
          <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {attempt.status === "SUBMITTED"
                ? "Your examination has been submitted"
                : "The examination time has ended"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This attempt is read-only. The answers below are the last answers
              confirmed by the server.
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3" aria-live="polite">
          {online ? (
            <Wifi aria-hidden="true" className="size-4 text-success" />
          ) : (
            <WifiOff aria-hidden="true" className="size-4 text-destructive" />
          )}
          <p
            className={`text-sm font-medium ${
              hasFailed || !online ? "text-destructive" : "text-foreground"
            }`}
          >
            {statusText}
          </p>
        </div>
        {hasFailed && online && isActive && (
          <Button
            onClick={() => void reconcile()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Save aria-hidden="true" data-icon="inline-start" />
            Retry and sync
          </Button>
        )}
      </div>

      {(!online || hasFailed || message) && isActive && (
        <div
          className="mb-5 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm leading-6"
          role="status"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p>
            {message ??
              "Unconfirmed local changes are not guaranteed to survive a refresh or device failure. Your deadline continues while disconnected."}
          </p>
        </div>
      )}

      {attempt.instructions && (
        <details className="mb-6 rounded-xl border border-border bg-background px-5 py-4">
          <summary className="cursor-pointer font-medium">
            Examination instructions
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-muted-foreground">
            {attempt.instructions}
          </p>
        </details>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <article
            aria-labelledby={`question-${currentQuestion.id}`}
            className="rounded-2xl border border-border bg-background p-5 sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Question {currentIndex + 1} of {questions.length}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {questionTypeLabel(currentQuestion)}
                </p>
              </div>
              <p className="rounded-full bg-surface-muted px-3 py-1.5 text-sm font-semibold">
                {currentQuestion.marks}{" "}
                {currentQuestion.marks === 1 ? "mark" : "marks"}
              </p>
            </div>

            <h2
              className="mt-7 whitespace-pre-wrap font-heading text-xl font-semibold leading-8 tracking-tight sm:text-2xl"
              id={`question-${currentQuestion.id}`}
            >
              {currentQuestion.prompt}
            </h2>

            <div className="mt-7 space-y-3">
              {currentQuestion.type === "SINGLE_CHOICE" &&
                currentQuestion.options.map((option, index) => {
                  const selected =
                    currentProgress.answer?.kind === "single" &&
                    currentProgress.answer.optionId === option.id;
                  return (
                    <label
                      className={`flex min-h-14 cursor-pointer items-start gap-4 rounded-xl border px-4 py-4 text-base leading-6 transition-colors focus-within:ring-2 focus-within:ring-ring ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-surface-muted/60"
                      } ${!isActive ? "cursor-default" : ""}`}
                      key={option.id}
                    >
                      <input
                        checked={selected}
                        className="mt-1 size-4 accent-primary"
                        disabled={!isActive}
                        name={currentQuestion.id}
                        onChange={() =>
                          changeQuestionState(currentQuestion.id, (current) => ({
                            ...current,
                            answer: { kind: "single", optionId: option.id },
                          }))
                        }
                        type="radio"
                      />
                      <span className="font-medium text-muted-foreground">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option.text}</span>
                    </label>
                  );
                })}

              {currentQuestion.type === "MULTIPLE_SELECT" &&
                currentQuestion.options.map((option, index) => {
                  const selected =
                    currentProgress.answer?.kind === "multiple" &&
                    currentProgress.answer.optionIds.includes(option.id);
                  return (
                    <label
                      className={`flex min-h-14 cursor-pointer items-start gap-4 rounded-xl border px-4 py-4 text-base leading-6 transition-colors focus-within:ring-2 focus-within:ring-ring ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-surface-muted/60"
                      } ${!isActive ? "cursor-default" : ""}`}
                      key={option.id}
                    >
                      <input
                        checked={selected}
                        className="mt-1 size-4 accent-primary"
                        disabled={!isActive}
                        onChange={() => {
                          const oldIds =
                            currentProgress.answer?.kind === "multiple"
                              ? currentProgress.answer.optionIds
                              : [];
                          const nextIds = selected
                            ? oldIds.filter((id) => id !== option.id)
                            : [...oldIds, option.id];
                          changeQuestionState(
                            currentQuestion.id,
                            (current) => ({
                              ...current,
                              answer: {
                                kind: "multiple",
                                optionIds: nextIds,
                              },
                            }),
                          );
                        }}
                        type="checkbox"
                      />
                      <span className="font-medium text-muted-foreground">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option.text}</span>
                    </label>
                  );
                })}

              {currentQuestion.type === "WRITTEN" && (
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    htmlFor={`answer-${currentQuestion.id}`}
                  >
                    Your response
                  </label>
                  <textarea
                    className="min-h-56 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-base leading-7 outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:bg-surface-muted"
                    disabled={!isActive}
                    id={`answer-${currentQuestion.id}`}
                    onChange={(event) =>
                      changeQuestionState(currentQuestion.id, (current) => ({
                        ...current,
                        answer: {
                          kind: "written",
                          text: event.target.value,
                        },
                      }))
                    }
                    placeholder="Write your response here"
                    value={
                      currentProgress.answer?.kind === "written"
                        ? currentProgress.answer.text
                        : ""
                    }
                  />
                </div>
              )}
            </div>

            <div className="mt-7 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                aria-pressed={currentProgress.markedForReview}
                className={`inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-md border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                  currentProgress.markedForReview
                    ? "border-warning/50 bg-warning/10 text-foreground"
                    : "border-border hover:bg-surface-muted"
                }`}
                disabled={!isActive}
                onClick={() =>
                  changeQuestionState(currentQuestion.id, (current) => ({
                    ...current,
                    markedForReview: !current.markedForReview,
                  }))
                }
                type="button"
              >
                <Flag aria-hidden="true" className="size-4" />
                {currentProgress.markedForReview
                  ? "Remove review mark"
                  : "Mark for review"}
              </button>
              <div className="flex items-center justify-between gap-3">
                <Button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((index) => index - 1)}
                  type="button"
                  variant="outline"
                >
                  <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                  Previous
                </Button>
                {currentIndex < questions.length - 1 ? (
                  <Button
                    onClick={() => setCurrentIndex((index) => index + 1)}
                    type="button"
                  >
                    Next
                    <ArrowRight aria-hidden="true" data-icon="inline-end" />
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  Question overview
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {progressSummary}
                </p>
              </div>
              {reviewCount > 0 && (
                <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold">
                  {reviewCount} to review
                </span>
              )}
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {questions.map((question, index) => {
                const state = progress[question.id];
                const answered = hasAnswer(state.answer);
                const isCurrent = currentIndex === index;
                return (
                  <button
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Question ${index + 1}, ${
                      answered ? "answered" : "unanswered"
                    }${state.markedForReview ? ", marked for review" : ""}`}
                    className={`relative flex aspect-square min-h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : answered
                          ? "border-success/40 bg-success/10"
                          : "border-border bg-background hover:bg-surface-muted"
                    }`}
                    key={question.id}
                    onClick={() => setCurrentIndex(index)}
                    type="button"
                  >
                    {answered && !isCurrent ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : (
                      index + 1
                    )}
                    {state.markedForReview && (
                      <span
                        aria-hidden="true"
                        className={`absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-warning ${
                          isCurrent ? "border-primary" : ""
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span aria-hidden="true" className="size-3 rounded-sm border border-border" />
                Unanswered
              </p>
              <p className="flex items-center gap-2">
                <span aria-hidden="true" className="size-3 rounded-sm bg-success/25" />
                Answered
              </p>
              <p className="flex items-center gap-2">
                <span aria-hidden="true" className="size-3 rounded-full bg-warning" />
                Marked for review
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-background p-5">
            <div>
              <h2 className="font-heading text-lg font-semibold">Scratchpad</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Rough work only. This is not saved or submitted and clears when
                you refresh or leave this attempt.
              </p>
            </div>
            <label className="sr-only" htmlFor="attempt-scratchpad">
              Scratchpad notes
            </label>
            <textarea
              className="mt-4 min-h-40 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!isActive}
              id="attempt-scratchpad"
              onChange={(event) => setScratchpad(event.target.value)}
              placeholder="Use this space for rough work"
              value={scratchpad}
            />
          </section>

          {isActive && (
            <section className="rounded-2xl border border-border bg-background p-5">
              <h2 className="font-heading text-lg font-semibold">
                Ready to finish?
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Check unanswered questions and review marks before submitting.
                Submission is final.
              </p>
              <Button
                className="mt-4 w-full"
                onClick={() => setSubmitDialogOpen(true)}
                type="button"
              >
                Review and submit
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </Button>
            </section>
          )}
        </aside>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {answeredCount} answered · {questions.length - answeredCount} unanswered
        </span>
        {attempt.finalizedAt && (
          <span>
            Finalized{" "}
            <time dateTime={attempt.finalizedAt}>
              {new Date(attempt.finalizedAt).toISOString().replace("T", " ").slice(0, 16)} UTC
            </time>
          </span>
        )}
      </div>

      {submitDialogOpen && isActive && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
        >
          <section
            aria-labelledby="submit-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl"
            ref={submitDialogRef}
            role="alertdialog"
            tabIndex={-1}
          >
            <h2
              className="font-heading text-2xl font-semibold"
              id="submit-title"
            >
              Submit this examination?
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              You have answered {answeredCount} of {questions.length} questions
              and marked {reviewCount} for review. After submission, your answers
              cannot be changed.
            </p>
            {(hasPending || hasFailed || !online) && (
              <p className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm leading-6">
                Some changes are not confirmed by the server. They are not
                guaranteed to survive a connection or device failure and will
                not be included unless the server confirms them before
                submission.
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Button
                disabled={submitting}
                onClick={() => setSubmitDialogOpen(false)}
                type="button"
                variant="outline"
              >
                Keep working
              </Button>
              <Button
                disabled={submitting}
                onClick={() => void finalize(true)}
                type="button"
              >
                {submitting ? "Submitting…" : "Submit examination"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
