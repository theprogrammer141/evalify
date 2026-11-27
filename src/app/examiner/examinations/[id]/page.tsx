import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ExaminationContents,
  ExaminationSettingsForm,
} from "@/components/examinations/examination-setup";
import { requirePageRole } from "@/lib/auth/authorization";
import {
  getExaminerExamination,
  listQuestionBank,
} from "@/lib/examinations/service";

export const instant = false;

type PageProps = { params: Promise<{ id: string }> };

const stateLabels = {
  draft: "Draft",
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
} as const;

export default async function ExaminationPage({ params }: PageProps) {
  const user = await requirePageRole("EXAMINER");
  const { id } = await params;
  const [examination, questionBank] = await Promise.all([
    getExaminerExamination(user.id, id),
    listQuestionBank(user.id),
  ]);
  if (!examination) notFound();

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <header className="border-b border-border pb-8">
          <Link
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/examiner"
          >
            Back to examinations
          </Link>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                Examination setup
              </p>
              <h1 className="mt-2 break-words font-heading text-4xl tracking-tight sm:text-5xl">
                {examination.title}
              </h1>
            </div>
            <span className="border border-border px-3 py-2 text-sm font-medium">
              {stateLabels[examination.availability]}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Questions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {examination.questionCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total marks</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {examination.totalMarks}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Candidates</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {examination.candidateCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {examination.durationMinutes} min
              </p>
            </div>
          </div>
          {examination.status === "PUBLISHED" ? (
            <Link
              className="mt-6 inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              href={`/examiner/examinations/${examination.id}/monitor`}
            >
              Open monitoring
            </Link>
          ) : null}
        </header>

        <ExaminationSettingsForm examination={examination} />
        <ExaminationContents
          examination={examination}
          questionBank={questionBank}
        />
      </div>
    </AppShell>
  );
}