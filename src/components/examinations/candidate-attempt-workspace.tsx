"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Flag,
  LoaderCircle,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/feedback-provider";

type AttemptResponse =
  | { type: "options"; optionIds: string[] }
  | { type: "text"; text: string };

type AttemptQuestion = {
  id: string;
  position: number;
  prompt: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "WRITTEN_RESPONSE";
  marks: number;
  options: { id: string; text: string }[];
  answer: {
    response: AttemptResponse;
    markedForReview: boolean;
    updatedAt: string;
  } | null;
};

type Attempt = {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  remainingSeconds: number;
  questions: AttemptQuestion[];
};

type Announcement = {
  id: string;
  body: string;
  publishedAt: string;
  viewedAt: string | null;
};

type BrowserSignal =
  | "CONNECTION_INTERRUPTION"
  | "CONNECTION_RESTORED"
  | "SAVE_FAILURE"
  | "BROWSER_HIDDEN";

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getConnectionState() {
  return navigator.onLine;
}

function getServerConnectionState() {
  return true;
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

async function responseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return payload?.error ?? fallback;
}

export function CandidateAttemptWorkspace({
  examinationId,
  availability,
}: {
  examinationId: string;
  availability: "upcoming" | "ongoing" | "completed";
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Loading saved answers");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const online = useSyncExternalStore(
    subscribeToConnection,
    getConnectionState,
    getServerConnectionState,
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const toast = useToast();
  const timers = useRef(new Map<string, number>());
  const queues = useRef(new Map<string, Promise<void>>());
  const versions = useRef(new Map<string, number>());
  const currentAttemptStatus = useRef<Attempt["status"] | null>(null);
  const failedQuestions = useRef(new Set<string>());

  const loadAttempt = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examinationId}/attempt`,
        { cache: "no-store" },
      );
      if (response.status === 404) {
        setAttempt(null);
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError(await responseError(response, "Could not load the attempt."));
        setLoading(false);
        return;
      }
      const result = (await response.json()) as { attempt: Attempt };
      setAttempt(result.attempt);
      currentAttemptStatus.current = result.attempt.status;
      setRemainingSeconds(result.attempt.remainingSeconds);
      setSaveState("Server-saved answers restored");
      setLoading(false);
    } catch {
      setError("Could not reach the examination server.");
      setLoading(false);
    }
  }, [examinationId]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examinationId}/announcements`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setError("Examiner announcements could not be loaded. Retrying shortly.");
        return;
      }
      const result = (await response.json()) as {
        announcements: Announcement[];
      };
      setAnnouncements(result.announcements);
    } catch {
      setError("Examiner announcements could not be reached. Retrying shortly.");
    }
  }, [examinationId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadAttempt();
      void loadAnnouncements();
    }, 0);
    const announcementTimer = window.setInterval(() => {
      void loadAnnouncements();
    }, 10_000);
    const scheduledTimers = timers.current;
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(announcementTimer);
      for (const timer of scheduledTimers.values()) window.clearTimeout(timer);
    };
  }, [loadAttempt, loadAnnouncements]);

  useEffect(() => {
    if (attempt?.status !== "IN_PROGRESS") return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.status]);

  useEffect(() => {
    if (attempt?.status !== "IN_PROGRESS" || remainingSeconds !== 0) return;
    const timer = window.setInterval(() => void loadAttempt(), 10_000);
    return () => window.clearInterval(timer);
  }, [attempt?.status, loadAttempt, remainingSeconds]);

  useEffect(() => {
    function report(
      type: BrowserSignal,
      context: string,
    ) {
      if (currentAttemptStatus.current !== "IN_PROGRESS") return;
      void fetch(`/api/v1/candidate/examinations/${examinationId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, context }),
        keepalive: true,
      }).catch(() => {
        setError("A browser event could not be recorded while the connection was unavailable.");
      });
    }
    function handleOffline() {
      report(
        "CONNECTION_INTERRUPTION",
        "The browser reported an offline event.",
      );
    }
    function handleOnline() {
      report("CONNECTION_RESTORED", "The browser reported an online event.");
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        report("BROWSER_HIDDEN", "The browser tab reported that it was hidden.");
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [examinationId]);

  async function startAttempt() {
    setError("");
    setStarting(true);
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examinationId}/attempt`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await responseError(response, "Could not start the examination."));
        setStarting(false);
        return;
      }
      const result = (await response.json()) as { attempt: Attempt };
      setAttempt(result.attempt);
      currentAttemptStatus.current = result.attempt.status;
      setRemainingSeconds(result.attempt.remainingSeconds);
      setSaveState("All answers saved");
      setCurrentIndex(0);
      setStarting(false);
    } catch {
      setError("Could not reach the examination server.");
      setStarting(false);
    }
  }

  function updateAnswer(
    question: AttemptQuestion,
    response: AttemptResponse,
    markedForReview = question.answer?.markedForReview ?? false,
  ) {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const nextAnswer = {
      response,
      markedForReview,
      updatedAt: question.answer?.updatedAt ?? new Date().toISOString(),
    };
    setAttempt((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((item) =>
              item.id === question.id
                ? { ...item, answer: nextAnswer }
                : item,
            ),
          }
        : current,
    );

    const version = (versions.current.get(question.id) ?? 0) + 1;
    versions.current.set(question.id, version);
    const existingTimer = timers.current.get(question.id);
    if (existingTimer) window.clearTimeout(existingTimer);
    setSaveState("Saving answer…");
    const timer = window.setTimeout(() => {
      if (timers.current.get(question.id) === timer) {
        timers.current.delete(question.id);
      }
      const previous = queues.current.get(question.id) ?? Promise.resolve();
      const request = previous
        .catch(() => undefined)
        .then(async () => {
          try {
            const result = await fetch(
              `/api/v1/candidate/examinations/${examinationId}/attempt/answers/${question.id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ response, markedForReview }),
              },
            );
            if (!result.ok) {
              if (result.status === 409) {
                await loadAttempt();
                return;
              }
              failedQuestions.current.add(question.id);
              if (versions.current.get(question.id) === version) {
                setSaveState("Answer not saved. Check your connection and try again.");
              }
              reportSaveFailure();
              return;
            }
            failedQuestions.current.delete(question.id);
            if (versions.current.get(question.id) === version) {
              setSaveState("All answers saved");
            }
          } catch {
            failedQuestions.current.add(question.id);
            if (versions.current.get(question.id) === version) {
              setSaveState("Answer not saved. Check your connection and try again.");
            }
            reportSaveFailure();
          }
        });
      queues.current.set(question.id, request);
    }, 350);
    timers.current.set(question.id, timer);
  }

  function reportSaveFailure() {
    if (currentAttemptStatus.current !== "IN_PROGRESS") return;
    void fetch(`/api/v1/candidate/examinations/${examinationId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "SAVE_FAILURE",
        context: "An answer save request was not accepted by the server.",
      }),
    }).catch(() => {
      setError("The failed save could not be recorded as an examination event.");
    });
  }

  async function markAnnouncementRead(announcementId: string) {
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examinationId}/announcements/${announcementId}/read`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError("The announcement could not be marked as read.");
        return;
      }
      setAnnouncements((items) =>
        items.map((item) =>
          item.id === announcementId
            ? { ...item, viewedAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch {
      setError("The announcement could not be reached.");
    }
  }

  async function submitAttempt() {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    setError("");
    setSubmitting(true);
    while (timers.current.size > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    await Promise.all(queues.current.values());
    if (failedQuestions.current.size > 0) {
      setError("An answer is not confirmed as saved. Retry saving before submitting.");
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examinationId}/attempt/submit`,
        { method: "POST" },
      );
      if (!response.ok && response.status !== 409) {
        setError(await responseError(response, "The attempt could not be submitted."));
        setSubmitting(false);
        return;
      }
      await loadAttempt();
      toast("Your examination has been submitted.");
      setSubmitting(false);
    } catch {
      setError("Could not reach the examination server to submit.");
      setSubmitting(false);
    }
  }

  const answeredCount =
    attempt?.questions.filter((question) => {
      const response = question.answer?.response;
      return response?.type === "options"
        ? response.optionIds.length > 0
        : response?.type === "text" && response.text.trim().length > 0;
    }).length ?? 0;
  const unansweredCount = (attempt?.questions.length ?? 0) - answeredCount;
  const reviewCount =
    attempt?.questions.filter((question) => question.answer?.markedForReview)
      .length ?? 0;
  const currentQuestion = attempt?.questions[currentIndex] ?? null;
  const currentResponse = currentQuestion?.answer?.response;
  const newAnnouncements = announcements.filter(
    (announcement) => !announcement.viewedAt,
  ).length;

  if (loading) {
    return (
      <section aria-live="polite" className="border-t border-border py-7">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading examination workspace
        </p>
      </section>
    );
  }

  return (
    <div className="border-t border-border py-7">
      {error ? (
        <p
          className="mb-5 flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {announcements.length > 0 ? (
        <section
          aria-labelledby="candidate-announcements-heading"
          className="mb-8 border border-border bg-muted/30 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              className="flex items-center gap-2 font-heading text-lg"
              id="candidate-announcements-heading"
            >
              <Bell aria-hidden="true" className="size-4" />
              Examiner announcements
            </h2>
            <span className="text-sm text-muted-foreground">
              {newAnnouncements} new
            </span>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {announcements.map((announcement) => (
              <li className="py-4 first:pt-0 last:pb-0" key={announcement.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(announcement.publishedAt)} UTC
                  </p>
                  {announcement.viewedAt ? (
                    <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                      <Check aria-hidden="true" className="size-3.5" />
                      Read
                    </span>
                  ) : (
                    <button
                      className="min-h-11 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() => void markAnnouncementRead(announcement.id)}
                      type="button"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7">
                  {announcement.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!attempt ? (
        <section aria-labelledby="attempt-start-heading">
          <h2 className="font-heading text-2xl" id="attempt-start-heading">
            Examination attempt
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your answers are recorded by the examination server. The deadline
            continues during connection interruptions.
          </p>
          {availability === "ongoing" ? (
            <button
              className="mt-5 inline-flex min-h-11 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={starting}
              onClick={() => void startAttempt()}
              type="button"
            >
              {starting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              Start examination
            </button>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              This examination is not available to start right now.
            </p>
          )}
        </section>
      ) : (
        <section aria-labelledby="attempt-heading">
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Examination attempt
              </p>
              <h2
                className="mt-1 font-heading text-2xl"
                id="attempt-heading"
              >
                {attempt.status === "IN_PROGRESS"
                  ? "Attempt in progress"
                  : attempt.status === "SUBMITTED"
                    ? "Attempt submitted"
                    : "Attempt expired"}
              </h2>
            </div>
            <div
              aria-live="off"
              className="flex items-center gap-2 border border-border px-4 py-3 tabular-nums"
              title="The server enforces the deadline"
            >
              {attempt.status === "IN_PROGRESS" ? (
                <>
                  <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="font-mono text-lg font-semibold">
                    {formatTime(remainingSeconds)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">remaining</span>
                </>
              ) : (
                <span className="text-sm font-medium">
                  {attempt.status === "SUBMITTED" ? "Submitted" : "Time ended"}
                </span>
              )}
            </div>
          </header>

          <div className="mt-6 grid gap-3 border-y border-border py-4 sm:grid-cols-4">
            <p className="text-sm">
              <strong className="tabular-nums">{attempt.questions.length}</strong>{" "}
              questions
            </p>
            <p className="text-sm">
              <strong className="tabular-nums">{answeredCount}</strong> answered
            </p>
            <p className="text-sm">
              <strong className="tabular-nums">{unansweredCount}</strong>{" "}
              unanswered
            </p>
            <p className="text-sm">
              <strong className="tabular-nums">{reviewCount}</strong> for review
            </p>
          </div>

          {attempt.status === "IN_PROGRESS" && currentQuestion ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_250px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Question {currentQuestion.position} of{" "}
                    {attempt.questions.length} · {currentQuestion.marks} marks
                  </p>
                  <p
                    aria-live="polite"
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    {online ? (
                      <Wifi
                        aria-hidden="true"
                        className="size-4 text-emerald-700"
                      />
                    ) : (
                      <WifiOff
                        aria-hidden="true"
                        className="size-4 text-amber-700"
                      />
                    )}
                    {online ? saveState : "Connection unavailable"}
                  </p>
                </div>
                <h3 className="mt-5 whitespace-pre-wrap font-heading text-xl leading-8">
                  {currentQuestion.prompt}
                </h3>

                {currentQuestion.type === "WRITTEN_RESPONSE" ? (
                  <label className="mt-6 block text-sm font-medium">
                    Your response
                    <textarea
                      className="mt-2 min-h-44 w-full resize-y border border-border bg-background p-3 text-base leading-7 outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                      disabled={attempt.status !== "IN_PROGRESS" || submitting}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        updateAnswer(currentQuestion, {
                          type: "text",
                          text: event.target.value,
                        })
                      }
                      value={
                        currentResponse?.type === "text"
                          ? currentResponse.text
                          : ""
                      }
                    />
                  </label>
                ) : (
                  <fieldset className="mt-6 space-y-3" disabled={submitting}>
                    <legend className="sr-only">Choose your answer</legend>
                    {currentQuestion.options.map((option) => {
                      const selected =
                        currentResponse?.type === "options" &&
                        currentResponse.optionIds.includes(option.id);
                      return (
                        <label
                          className="flex min-h-12 cursor-pointer items-start gap-3 border border-border px-4 py-3 text-base leading-6 hover:bg-muted/40"
                          key={option.id}
                        >
                          <input
                            checked={selected}
                            className="mt-1 size-4 accent-primary"
                            disabled={submitting}
                            name={`question-${currentQuestion.id}`}
                            onChange={() => {
                              const previous =
                                currentResponse?.type === "options"
                                  ? currentResponse.optionIds
                                  : [];
                              const optionIds =
                                currentQuestion.type === "SINGLE_CHOICE"
                                  ? [option.id]
                                  : selected
                                    ? previous.filter((id) => id !== option.id)
                                    : [...previous, option.id];
                              updateAnswer(currentQuestion, {
                                type: "options",
                                optionIds,
                              });
                            }}
                            type={
                              currentQuestion.type === "SINGLE_CHOICE"
                                ? "radio"
                                : "checkbox"
                            }
                          />
                          <span>{option.text}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <button
                    className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                    disabled={currentIndex === 0 || submitting}
                    onClick={() => setCurrentIndex((index) => index - 1)}
                    type="button"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Previous
                  </button>
                  <button
                    aria-pressed={currentQuestion.answer?.markedForReview ?? false}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    disabled={submitting}
                    onClick={() =>
                      updateAnswer(
                        currentQuestion,
                        currentResponse ??
                          (currentQuestion.type === "WRITTEN_RESPONSE"
                            ? { type: "text", text: "" }
                            : { type: "options", optionIds: [] }),
                        !currentQuestion.answer?.markedForReview,
                      )
                    }
                    type="button"
                  >
                    <Flag aria-hidden="true" className="size-4" />
                    {currentQuestion.answer?.markedForReview
                      ? "Remove review mark"
                      : "Mark for review"}
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                    disabled={
                      currentIndex === attempt.questions.length - 1 || submitting
                    }
                    onClick={() => setCurrentIndex((index) => index + 1)}
                    type="button"
                  >
                    Next
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>

              <aside aria-label="Question navigation">
                <h3 className="font-heading text-base">Question list</h3>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {attempt.questions.map((question, index) => {
                    const answer = question.answer?.response;
                    const hasAnswer =
                      answer?.type === "options"
                        ? answer.optionIds.length > 0
                        : answer?.type === "text" &&
                          answer.text.trim().length > 0;
                    return (
                      <button
                        aria-current={index === currentIndex ? "step" : undefined}
                        aria-label={`Question ${question.position}${hasAnswer ? ", answered" : ", unanswered"}${question.answer?.markedForReview ? ", marked for review" : ""}`}
                        className={`min-h-11 border text-sm font-medium tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                          index === currentIndex
                            ? "border-primary bg-primary text-primary-foreground"
                            : hasAnswer
                              ? "border-emerald-700/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                              : "border-border bg-background hover:bg-muted"
                        }`}
                        key={question.id}
                        disabled={submitting}
                        onClick={() => setCurrentIndex(index)}
                        type="button"
                      >
                        {question.position}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Question progress is saved by the server. Review marks can
                  overlap answered or unanswered questions.
                </p>
              </aside>
            </div>
          ) : null}

          {attempt.status === "IN_PROGRESS" ? (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <p className="text-sm text-muted-foreground">
                {saveState} · Deadline set by the examination server
              </p>
              <button
                className="inline-flex min-h-11 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                disabled={submitting}
                onClick={() => setConfirmSubmitOpen(true)}
                type="button"
              >
                {submitting ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <Send aria-hidden="true" className="size-4" />
                )}
                Submit examination
              </button>
            </div>
          ) : (
            <p className="mt-6 flex items-start gap-2 border-l-2 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {attempt.status === "SUBMITTED"
                ? `Your attempt was submitted at ${formatDate(attempt.submittedAt ?? attempt.startedAt)} UTC.`
                : `The attempt expired at ${formatDate(attempt.expiresAt)} UTC. The server has finalized the accepted answers.`}
            </p>
          )}
        </section>
      )}
      <ConfirmDialog
        confirmLabel="Submit examination"
        destructive
        description="You cannot change your answers after submitting. Any unsaved answers must finish saving first."
        onConfirm={() => {
          setConfirmSubmitOpen(false);
          void submitAttempt();
        }}
        onOpenChange={setConfirmSubmitOpen}
        open={confirmSubmitOpen}
        pending={submitting}
        title="Submit your examination?"
      />
    </div>
  );
}
