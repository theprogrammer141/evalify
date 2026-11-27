import { AppShell } from "@/components/app-shell";
import { ExaminationList } from "@/components/candidate/examination-list";
import { listCandidateExaminations } from "@/lib/attempts/service";
import { requirePageRole } from "@/lib/auth/authorization";
import { listCandidateExaminations } from "@/lib/examinations/service";

export const instant = false;

export default async function CandidatePage() {
  const user = await requirePageRole("CANDIDATE");
  const { examinations } = await listCandidateExaminations(user.id);

  return (
    <AppShell user={user}>
      <section className="py-4">
        <p className="text-sm font-medium text-primary">
          Candidate workspace
        </p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          Your examinations
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          See what is available, continue an active attempt, or review the
          status of a completed examination.
        </p>
        <ExaminationList examinations={examinations} />
      </section>
    </AppShell>
  );
}
