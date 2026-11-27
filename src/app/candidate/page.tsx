import { AppShell } from "@/components/app-shell";
import { CandidateExaminationList } from "@/components/examinations/candidate-examination-list";
import { requirePageRole } from "@/lib/auth/authorization";
import { listCandidateExaminations } from "@/lib/examinations/service";

export const instant = false;

export default async function CandidatePage() {
  const user = await requirePageRole("CANDIDATE");
  const examinations = await listCandidateExaminations(user.id);

  return (
    <AppShell user={user}>
      <CandidateExaminationList examinations={examinations} />
    </AppShell>
  );
}
