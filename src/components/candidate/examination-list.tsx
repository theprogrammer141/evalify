"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Clock3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";

type ExaminationItem = {
  id: string;
  title: string;
  instructions: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  totalMarks: number;
  status: "DRAFT" | "PUBLISHED" | "COMPLETED";
  attemptId: string | null;
  attemptStatus: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | null;
  availability: "UNAVAILABLE" | "UPCOMING" | "CLOSED" | "AVAILABLE";
};

export function ExaminationList({
  examinations,
}: {
  examinations: ExaminationItem[];
}) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const groups = [
    {
      title: "In progress",
      items: examinations.filter(
        (examination) => examination.attemptStatus === "IN_PROGRESS",
      ),
    },
    {
      title: "Available now",
      items: examinations.filter(
        (examination) =>
          examination.availability === "AVAILABLE" &&
          examination.attemptStatus === null,
      ),
    },
    {
      title: "Upcoming",
      items: examinations.filter(
        (examination) =>
          examination.availability === "UPCOMING" &&
          examination.attemptStatus === null,
      ),
    },
    {
      title: "Completed or closed",
      items: examinations.filter(
        (examination) =>
          examination.attemptStatus === "SUBMITTED" ||
          examination.attemptStatus === "EXPIRED" ||
          (examination.availability === "CLOSED" &&
            examination.attemptStatus !== "IN_PROGRESS") ||
          (examination.availability === "UNAVAILABLE" &&
            examination.attemptStatus !== "IN_PROGRESS"),
      ),
    },
  ].filter((group) => group.items.length > 0);

  async function openExamination(examination: ExaminationItem) {
    if (examination.attemptId) {
      router.push(`/candidate/attempt/${examination.attemptId}`);
      return;
    }

    setStartingId(examination.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examination.id}/attempt`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        attempt?: { id: string };
        error?: string;
      };
      if (!response.ok || !result.attempt) {
        setError(
          result.error === "exam_not_available"
            ? "This examination is no longer available to start."
            : "The examination could not be opened. Try again.",
        );
        return;
      }
      router.push(`/candidate/attempt/${result.attempt.id}`);
    } catch {
      setError("Connection lost. The examination was not confirmed as started.");
    } finally {
      setStartingId(null);
    }
  }

  if (examinations.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-border bg-background px-6 py-12 sm:px-10">
        <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <h2 className="mt-6 font-heading text-2xl font-semibold">
          No examinations assigned
        </h2>
        <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
          Examinations assigned to your account will appear here with their
          start times and completion status.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-9">
      {error && (
        <ErrorMessage className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          {error}
        </ErrorMessage>
      )}
      <div className="space-y-10">
        {groups.map((group) => (
          <section aria-labelledby={`examinations-${group.title}`} key={group.title}>
            <h2
              className="mb-4 font-heading text-xl font-semibold"
              id={`examinations-${group.title}`}
            >
              {group.title}
            </h2>
            <ul className="space-y-4">
              {group.items.map((examination) => {
          const canOpen =
            examination.attemptId !== null ||
            examination.availability === "AVAILABLE";
          const stateLabel = examination.attemptStatus
            ? {
                IN_PROGRESS: "In progress",
                SUBMITTED: "Submitted",
                EXPIRED: "Time expired",
              }[examination.attemptStatus]
            : {
                UNAVAILABLE: "Not available",
                UPCOMING: "Upcoming",
                CLOSED: "Closed",
                AVAILABLE: "Available now",
              }[examination.availability];

          return (
            <li
              className="rounded-2xl border border-border bg-background p-5 sm:p-7"
              key={examination.id}
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                      {examination.title}
                    </h2>
                    <span className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className={`size-2 rounded-full ${
                          examination.attemptStatus === "IN_PROGRESS" ||
                          examination.availability === "AVAILABLE"
                            ? "bg-success"
                            : "bg-muted-foreground/50"
                        }`}
                      />
                      {stateLabel}
                    </span>
                  </div>
                  {examination.instructions && (
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                      {examination.instructions}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays aria-hidden="true" className="size-4" />
                      <time dateTime={examination.opensAt}>
                        {dateFormatter.format(new Date(examination.opensAt))}
                      </time>
                      <span aria-hidden="true">–</span>
                      <time dateTime={examination.closesAt}>
                        {dateFormatter.format(new Date(examination.closesAt))} UTC
                      </time>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 aria-hidden="true" className="size-4" />
                      {examination.durationMinutes} minutes
                    </span>
                    <span>{examination.totalMarks} marks</span>
                  </div>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  disabled={!canOpen || startingId === examination.id}
                  loading={startingId === examination.id}
                  onClick={() => void openExamination(examination)}
                  type="button"
                >
                  {startingId === examination.id
                    ? "Opening…"
                    : examination.attemptStatus
                      ? "Open attempt"
                      : "Start examination"}
                  <ArrowRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </div>
            </li>
              );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        Your attempt time is set by the server and continues during connection
        interruptions.
      </p>
    </div>
  );
}
