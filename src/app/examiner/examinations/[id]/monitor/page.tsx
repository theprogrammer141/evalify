import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExaminationMonitoringDashboard } from "@/components/examinations/examination-monitoring-dashboard";
import { requirePageUser } from "@/lib/auth/authorization";
import { getMonitoringDashboard } from "@/lib/monitoring/service";

export const instant = false;

type PageProps = { params: Promise<{ id: string }> };

export default async function ExaminationMonitoringPage({
  params,
}: PageProps) {
  const user = await requirePageUser();
  if (user.role !== "EXAMINER" && user.role !== "ADMIN") notFound();

  const { id } = await params;
  const initialData = await getMonitoringDashboard(id, {
    userId: user.id,
    isAdmin: user.role === "ADMIN",
  });
  if (!initialData) notFound();

  return (
    <AppShell user={user}>
      <ExaminationMonitoringDashboard
        examinationId={id}
        initialData={initialData}
      />
    </AppShell>
  );
}
