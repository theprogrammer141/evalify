import Link from "next/link";

type CandidateExamination = {
  id: string;
  title: string;
  instructions: string;
  startsAt: Date | string;
  endsAt: Date | string;
  durationMinutes: number;
  enrolledAt: Date | string;
  availability: "upcoming" | "ongoing" | "completed";
  questionCount: number;
  totalMarks: number;
};

const stateLabels = {
  upcoming: "Upcoming",
  ongoing: "Available now",
  completed: "Availability ended",
} as const;

function formatSchedule(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function CandidateExaminationList({
  examinations,
}: {
  examinations: CandidateExamination[];
}) {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl border-b border-border pb-8">
        <p className="text-sm font-medium text-muted-foreground">
          Candidate workspace
        </p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
          Your examinations
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Published examinations assigned to your account appear here with
          their instructions and availability window.
        </p>
      </header>

      {examinations.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {examinations.map((examination) => (
            <li className="py-6" key={examination.id}>
              <Link
                className="group grid gap-5 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                href={`/candidate/examinations/${examination.id}`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-heading text-2xl transition-colors group-hover:text-[#182d2b]">
                      {examination.title}
                    </h2>
                    <span className="border border-border px-2.5 py-1 text-xs font-medium">
                      {stateLabels[examination.availability]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {formatSchedule(examination.startsAt)} UTC –{" "}
                    {formatSchedule(examination.endsAt)} UTC
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {examination.durationMinutes} minutes ·{" "}
                    {examination.questionCount} questions ·{" "}
                    {examination.totalMarks} marks
                  </p>
                </div>
                <span className="min-h-11 content-center text-sm font-semibold underline-offset-4 group-hover:underline">
                  View instructions
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="border border-border bg-card px-6 py-12 sm:px-10">
          <h2 className="font-heading text-2xl">No examinations assigned</h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            When an examiner publishes an examination and enrolls your
            account, its instructions and schedule will appear here.
          </p>
        </section>
      )}
    </div>
  );
}

export function CandidateExaminationDetail({
  examination,
}: {
  examination: CandidateExamination;
}) {
  return (
    <div className="space-y-8">
      <Link
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        href="/candidate"
      >
        Back to your examinations
      </Link>

      <article className="border border-border bg-card p-5 sm:p-9">
        <header className="border-b border-border pb-7">
          <p className="text-sm font-medium text-muted-foreground">
            Assigned examination
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <h1 className="max-w-3xl break-words font-heading text-4xl tracking-tight sm:text-5xl">
              {examination.title}
            </h1>
            <span className="border border-border px-3 py-2 text-sm font-medium">
              {stateLabels[examination.availability]}
            </span>
          </div>
        </header>

        <dl className="grid gap-x-8 gap-y-6 border-b border-border py-7 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">
              Available from (UTC)
            </dt>
            <dd className="mt-2 text-base font-medium">
              {formatSchedule(examination.startsAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              Available until (UTC)
            </dt>
            <dd className="mt-2 text-base font-medium">
              {formatSchedule(examination.endsAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              Examination duration
            </dt>
            <dd className="mt-2 text-base font-medium">
              {examination.durationMinutes} minutes
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Question set</dt>
            <dd className="mt-2 text-base font-medium">
              {examination.questionCount} questions · {examination.totalMarks}{" "}
              marks
            </dd>
          </div>
        </dl>

        <section className="py-7">
          <h2 className="font-heading text-2xl">Instructions</h2>
          <p className="mt-4 whitespace-pre-wrap text-base leading-7">
            {examination.instructions}
          </p>
        </section>

        <p className="border-l-2 border-[#182d2b] bg-muted/40 px-4 py-4 text-sm leading-6 text-muted-foreground">
          This phase shows assigned examination details only. Examination
          questions and attempt controls are not available here.
        </p>
      </article>
    </div>
  );
}