"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  Bell,
  Check,
  Clock3,
  LoaderCircle,
  Radio,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";

type CandidateStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "EXPIRED";

type MonitorCandidate = {
  candidateId: string;
  email: string;
  attemptId?: string;
  status: CandidateStatus;
  startedAt: Date | string | null;
  expiresAt: Date | string | null;
  submittedAt: Date | string | null;
  remainingSeconds: number | null;
  questionCount: number;
  answeredCount: number;
  unansweredCount: number;
  reviewCount: number;
};

type MonitorEvent = {
  id: string;
  candidateEmail: string;
  type:
    | "CONNECTION_INTERRUPTION"
    | "CONNECTION_RESTORED"
    | "SAVE_FAILURE"
    | "BROWSER_HIDDEN";
  context: string;
  recordedAt: Date | string;
};

type Announcement = {
  id: string;
  body: string;
  publishedAt: Date | string;
  senderEmail: string;
};

type MonitoringDashboard = {
  examination: {
    id: string;
    title: string;
    startsAt: Date | string;
    endsAt: Date | string;
    status: "DRAFT" | "PUBLISHED";
  };
  serverTime: Date | string;
  counts: {
    enrolled: number;
    started: number;
    submitted: number;
    expired: number;
    notStarted: number;
    inProgress: number;
  };
  candidates: MonitorCandidate[];
  events: MonitorEvent[];
  announcements: Announcement[];
};

const candidateStatusLabels: Record<CandidateStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  EXPIRED: "Expired",
};

const eventLabels: Record<MonitorEvent["type"], string> = {
  CONNECTION_INTERRUPTION: "Connection interruption",
  CONNECTION_RESTORED: "Connection restored",
  SAVE_FAILURE: "Answer save failed",
  BROWSER_HIDDEN: "Browser tab hidden",
};

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRemaining(seconds: number | null) {
  if (seconds === null) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

async function getError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return payload?.error ?? fallback;
}

export function ExaminationMonitoringDashboard({
  examinationId,
  initialData,
}: {
  examinationId: string;
  initialData: MonitoringDashboard;
}) {
  const [data, setData] = useState(initialData);
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    initialData.candidates[0]?.candidateId ?? "",
  );
  const [announcement, setAnnouncement] = useState("");
  const [sending, setSending] = useState(false);
  const [announcementNotice, setAnnouncementNotice] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const selectedCandidate = data.candidates.find(
    (candidate) => candidate.candidateId === selectedCandidateId,
  );
  const selectedEvents = useMemo(
    () =>
      data.events.filter(
        (event) => event.candidateEmail === selectedCandidate?.email,
      ),
    [data.events, selectedCandidate?.email],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examinationId}/monitor`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setError(await getError(response, "Monitoring data could not be refreshed."));
        return;
      }
      const next = (await response.json()) as MonitoringDashboard;
      setData(next);
      setSelectedCandidateId((current) =>
        next.candidates.some((candidate) => candidate.candidateId === current)
          ? current
          : (next.candidates[0]?.candidateId ?? ""),
      );
      setError("");
    } catch {
      setError("Monitoring data could not be reached. The last update remains visible.");
    } finally {
      setRefreshing(false);
    }
  }, [examinationId]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnnouncementNotice("");
    setError("");
    setSending(true);
    try {
      const response = await fetch(
        `/api/v1/examiner/examinations/${examinationId}/announcements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: announcement }),
        },
      );
      if (!response.ok) {
        setError(await getError(response, "The announcement was not sent."));
        return;
      }
      setAnnouncement("");
      setAnnouncementNotice("Announcement sent to enrolled candidates.");
      await refresh();
    } catch {
      setError("The announcement could not be sent. Your text is still available in the form.");
    } finally {
      setSending(false);
    }
  }

  const countCards = [
    { label: "Enrolled", value: data.counts.enrolled, icon: Users },
    { label: "Started", value: data.counts.started, icon: Radio },
    { label: "Submitted", value: data.counts.submitted, icon: Check },
    { label: "Expired", value: data.counts.expired, icon: Clock3 },
    { label: "Not started", value: data.counts.notStarted, icon: Clock3 },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            Examination monitoring
          </p>
          <h1 className="mt-2 break-words font-heading text-3xl tracking-tight sm:text-4xl">
            {data.examination.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Candidate progress and recorded events · All times UTC
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-border px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
          disabled={refreshing}
          onClick={() => void refresh()}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </header>

      {error ? (
        <p
          className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <section aria-label="Candidate totals" className="grid grid-cols-2 border-y border-border sm:grid-cols-3 lg:grid-cols-5">
        {countCards.map(({ label, value, icon: Icon }) => (
          <div
            className="border-b border-border px-4 py-5 first:pl-0 sm:py-6 lg:border-b-0 lg:py-7"
            key={label}
          >
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{label}</span>
              <Icon aria-hidden="true" className="size-4" />
            </div>
            <p className="mt-3 font-heading text-3xl tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="candidate-progress-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl" id="candidate-progress-heading">
              Candidate progress
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              In-progress status comes from attempt records; it does not indicate a live connection.
            </p>
          </div>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {refreshing ? "Updating…" : `Updated ${formatDate(data.serverTime)} UTC`}
          </p>
        </div>

        {data.candidates.length > 0 ? (
          <>
            <ul className="divide-y divide-border border-y border-border sm:hidden">
              {data.candidates.map((candidate) => (
                <li className="py-4" key={candidate.candidateId}>
                  <button
                    aria-current={
                      candidate.candidateId === selectedCandidateId
                        ? "true"
                        : undefined
                    }
                    className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() =>
                      setSelectedCandidateId(candidate.candidateId)
                    }
                    type="button"
                  >
                    <span className="flex min-h-11 items-center justify-between gap-3">
                      <span className="max-w-[65%] truncate font-medium">
                        {candidate.email}
                      </span>
                      <span className="shrink-0 border border-border px-2.5 py-1 text-[13px]">
                        {candidateStatusLabels[candidate.status]}
                      </span>
                    </span>
                    <span className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <span>
                        {candidate.answeredCount} answered ·{" "}
                        {candidate.unansweredCount} unanswered
                      </span>
                      <span className="text-right">
                        {candidate.status === "IN_PROGRESS"
                          ? formatRemaining(candidate.remainingSeconds)
                          : formatDate(candidate.startedAt)}
                      </span>
                    </span>
                    <span className="mt-2 block text-[13px] text-muted-foreground">
                      {candidate.reviewCount} marked for review
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto border-y border-border sm:block">
              <table className="w-full min-w-[790px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Candidate</th>
                  <th className="py-3 pr-4 font-medium">Attempt</th>
                  <th className="py-3 pr-4 font-medium">Questions</th>
                  <th className="py-3 pr-4 font-medium">Review</th>
                  <th className="py-3 pr-4 font-medium">Remaining</th>
                  <th className="py-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.candidates.map((candidate) => (
                  <tr
                    className={`transition-colors ${candidate.candidateId === selectedCandidateId ? "bg-muted/50" : "hover:bg-muted/30"}`}
                    key={candidate.candidateId}
                  >
                    <td className="py-4 pr-4">
                      <button
                        aria-current={
                          candidate.candidateId === selectedCandidateId
                            ? "true"
                            : undefined
                        }
                        className="min-h-11 max-w-full text-left font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() =>
                          setSelectedCandidateId(candidate.candidateId)
                        }
                        type="button"
                      >
                        <span className="block max-w-[260px] truncate">
                          {candidate.email}
                        </span>
                      </button>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="inline-flex min-h-8 items-center border border-border px-2.5">
                        {candidateStatusLabels[candidate.status]}
                      </span>
                    </td>
                    <td className="py-4 pr-4 tabular-nums">
                      {candidate.answeredCount} answered
                      <span className="block text-[13px] text-muted-foreground">
                        {candidate.unansweredCount} unanswered
                      </span>
                    </td>
                    <td className="py-4 pr-4 tabular-nums">
                      {candidate.reviewCount}
                    </td>
                    <td className="py-4 pr-4 font-mono tabular-nums">
                      {candidate.status === "IN_PROGRESS"
                        ? formatRemaining(candidate.remainingSeconds)
                        : "—"}
                    </td>
                    <td className="py-4 text-muted-foreground">
                      {formatDate(candidate.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="border-y border-border py-8 text-sm text-muted-foreground">
            No candidates are enrolled in this examination.
          </p>
        )}
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="attempt-details-heading">
            <h2 className="font-heading text-2xl" id="attempt-details-heading">
              Attempt details
            </h2>
            {selectedCandidate ? (
              selectedCandidate.status === "NOT_STARTED" ? (
                <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
                  {selectedCandidate.email} has not started an attempt.
                </p>
              ) : (
                <div className="mt-4 border-y border-border py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{selectedCandidate.email}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {candidateStatusLabels[selectedCandidate.status]}
                      </p>
                    </div>
                    <span className="font-mono text-lg tabular-nums">
                      {formatRemaining(selectedCandidate.remainingSeconds)}
                    </span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Started</dt>
                      <dd className="mt-1 text-sm">{formatDate(selectedCandidate.startedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Expires</dt>
                      <dd className="mt-1 text-sm">{formatDate(selectedCandidate.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Answered</dt>
                      <dd className="mt-1 text-sm tabular-nums">
                        {selectedCandidate.answeredCount} / {selectedCandidate.questionCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted-foreground">Marked for review</dt>
                      <dd className="mt-1 text-sm tabular-nums">
                        {selectedCandidate.reviewCount}
                      </dd>
                    </div>
                  </dl>
                  {selectedCandidate.submittedAt ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Submitted {formatDate(selectedCandidate.submittedAt)} UTC
                    </p>
                  ) : null}
                </div>
              )
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Select an enrolled candidate to inspect their attempt.
              </p>
            )}
          </section>

          <section aria-labelledby="incident-review-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl" id="incident-review-heading">
                  Recorded events
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Browser signals are context for review, not evidence of misconduct.
                </p>
              </div>
              {selectedCandidate ? (
                <span className="text-sm text-muted-foreground">
                  {selectedEvents.length} for this candidate
                </span>
              ) : null}
            </div>
            {selectedEvents.length > 0 ? (
              <ol className="mt-4 divide-y divide-border border-y border-border">
                {selectedEvents.map((event) => (
                  <li className="py-4" key={event.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {eventLabels[event.type]}
                      </p>
                      <time className="text-[13px] text-muted-foreground">
                        {formatDate(event.recordedAt)} UTC
                      </time>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {event.context}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
                {selectedCandidate
                  ? "No events have been recorded for this candidate."
                  : "Select a candidate to review their recorded events."}
              </p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="send-announcement-heading">
            <h2 className="font-heading text-2xl" id="send-announcement-heading">
              Send an announcement
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Announcements appear inside enrolled candidates’ examination workspaces.
            </p>
            <form className="mt-4" onSubmit={(event) => void sendAnnouncement(event)}>
              <label className="block text-sm font-medium" htmlFor="announcement-body">
                Announcement
              </label>
              <textarea
                className="mt-2 min-h-32 w-full border border-border bg-background p-3 text-base leading-6 outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                id="announcement-body"
                maxLength={2000}
                onChange={(event) => setAnnouncement(event.target.value)}
                required
                value={announcement}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  {announcement.length} / 2,000 characters
                </p>
                <button
                  className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={sending || announcement.trim().length === 0}
                  type="submit"
                >
                  {sending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Send aria-hidden="true" className="size-4" />
                  )}
                  Send announcement
                </button>
              </div>
              {announcementNotice ? (
                <p
                  aria-live="polite"
                  className="mt-3 flex items-center gap-2 text-sm text-emerald-800"
                  role="status"
                >
                  <Check aria-hidden="true" className="size-4" />
                  {announcementNotice}
                </p>
              ) : null}
            </form>
          </section>

          <section aria-labelledby="announcement-history-heading">
            <div className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-4 text-muted-foreground" />
              <h2
                className="font-heading text-2xl"
                id="announcement-history-heading"
              >
                Announcement history
              </h2>
            </div>
            {data.announcements.length > 0 ? (
              <ol className="mt-4 divide-y divide-border border-y border-border">
                {data.announcements.map((item) => (
                  <li className="py-4" key={item.id}>
                    <time className="text-[13px] text-muted-foreground">
                      {formatDate(item.publishedAt)} UTC
                    </time>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 border-y border-border py-5 text-sm text-muted-foreground">
                No announcements have been sent.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
