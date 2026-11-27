import { AppShell } from "@/components/app-shell";
import { ReportCenter } from "@/components/examinations/report-center";
import { requirePageRole } from "@/lib/auth/authorization";
import { listExaminerEvaluations } from "@/lib/evaluations/service";
import { listExaminerReports } from "@/lib/reports/service";

export const instant = false;

export default async function ExaminerReportsPage() {
  const user = await requirePageRole("EXAMINER");
  await listExaminerEvaluations(user.id);
  const examinations = await listExaminerReports(user.id);

  return (
    <AppShell user={user}>
      <ReportCenter initialExaminations={examinations} />
    </AppShell>
  );
}
