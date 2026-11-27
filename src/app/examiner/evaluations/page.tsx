import { AppShell } from "@/components/app-shell";
import { EvaluationQueue } from "@/components/examinations/evaluation-queue";
import { requirePageRole } from "@/lib/auth/authorization";
import { listExaminerEvaluations } from "@/lib/evaluations/service";

export const instant = false;

export default async function ExaminerEvaluationsPage() {
  const user = await requirePageRole("EXAMINER");
  const evaluations = await listExaminerEvaluations(user.id);

  return (
    <AppShell user={user}>
      <EvaluationQueue evaluations={evaluations} />
    </AppShell>
  );
}
