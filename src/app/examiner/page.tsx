import { AppShell } from "@/components/app-shell";
import { ExaminerDashboard } from "@/components/examinations/examiner-dashboard";
import { requirePageRole } from "@/lib/auth/authorization";
import { listExaminations } from "@/lib/examinations/service";

export const instant = false;

export default async function ExaminerPage() {
  const user = await requirePageRole("EXAMINER");
  const examinations = await listExaminations(user.id);

  return (
    <AppShell user={user}>
      <ExaminerDashboard examinations={examinations} />
    </AppShell>
  );
}
