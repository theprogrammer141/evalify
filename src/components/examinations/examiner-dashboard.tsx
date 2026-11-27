import Link from "next/link";
import {
  ArrowUpRight,
  CirclePlus,
  ClipboardCheck,
  ClipboardList,
} from "lucide-react";

type ExaminationSummary = {
  id: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string;
  durationMinutes: number;
  availability: "draft" | "upcoming" | "ongoing" | "completed";
  questionCount: number;
  candidateCount: number;
  totalMarks: number;
};

const stateLabels: Record<ExaminationSummary["availability"], string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
};

function formatSchedule(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ExaminerDashboard({
  examinations,
}: {
  examinations: ExaminationSummary[];
}) {
  const draftCount = examinations.filter(
    (examination) => examination.availability === "draft",
  ).length;
  const publishedCount = examinations.length - draftCount;
  const candidateCount = examinations.reduce(
    (total, examination) => total + examination.candidateCount,
    0,
  );

  return (
    <div className="space-y-12">
      <section className="flex flex-col justify-between gap-8 border-b border-border pb-10 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">
            Examiner workspace
          </p>
          <h1 className="mt-3 font-heading text-4xl leading-tight tracking-tight sm:text-5xl">
            Examination setup
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Prepare question sets, set availability and enroll candidates
            before an examination is published.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href="/examiner/evaluations"
          >
            <ClipboardCheck aria-hidden="true" className="size-4" />
            Evaluation queue
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href="/examiner/examinations/new"
          >
            <CirclePlus aria-hidden="true" className="size-4" />
            Create examination
          </Link>
        </div>
      </section>

      <section aria-label="Examination overview" className="grid border-y border-border sm:grid-cols-3">
        <div className="border-b border-border py-5 sm:border-b-0 sm:py-6 sm:pr-8">
          <p className="text-sm text-muted-foreground">Examinations</p>
          <p className="mt-2 font-heading text-3xl tabular-nums">
            {examinations.length}
          </p>
        </div>
        <div className="border-b border-border py-5 sm:border-b-0 sm:border-l sm:px-8 sm:py-6">
          <p className="text-sm text-muted-foreground">Drafts to review</p>
          <p className="mt-2 font-heading text-3xl tabular-nums">
            {draftCount}
          </p>
        </div>
        <div className="py-5 sm:border-l sm:py-6 sm:pl-8">
          <p className="text-sm text-muted-foreground">Enrolled places</p>
          <p className="mt-2 font-heading text-3xl tabular-nums">
            {candidateCount}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl">Your examinations</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {publishedCount} published · {draftCount} in draft
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 transition hover:underline"
            href="/examiner/questions"
          >
            <ClipboardList aria-hidden="true" className="size-4" />
            Open question bank
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {examinations.length === 0 ? (
          <div className="border border-border bg-card px-6 py-12 sm:px-10">
            <h3 className="font-heading text-2xl">No examinations yet</h3>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Create a draft to add its instructions and schedule. Then build
              the question set and enroll its candidates.
            </p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
              href="/examiner/examinations/new"
            >
              Start a draft
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {examinations.map((examination) => (
              <Link
                className="group grid gap-5 py-6 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center sm:px-3"
                href={`/examiner/examinations/${examination.id}`}
                key={examination.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate font-heading text-xl">
                      {examination.title}
                    </h3>
                    <span className="border border-border px-2.5 py-1 text-xs font-medium">
                      {stateLabels[examination.availability]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatSchedule(examination.startsAt)} UTC
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm sm:text-right">
                  <span>
                    <strong className="block font-semibold tabular-nums">
                      {examination.questionCount}
                    </strong>
                    <span className="text-muted-foreground">questions</span>
                  </span>
                  <span>
                    <strong className="block font-semibold tabular-nums">
                      {examination.candidateCount}
                    </strong>
                    <span className="text-muted-foreground">candidates</span>
                  </span>
                  <span>
                    <strong className="block font-semibold tabular-nums">
                      {examination.totalMarks}
                    </strong>
                    <span className="text-muted-foreground">marks</span>
                  </span>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="hidden size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block"
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}