import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth/authorization";

export const instant = false;

export default async function ExaminerPage() {
  const user = await requirePageRole("EXAMINER");

  return (
    <AppShell user={user}>
      <section className="py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Examiner workspace
        </p>
        <h1 className="mt-3 font-heading text-4xl">Examination workspace</h1>
        <div className="mt-10 border border-border bg-background p-8 sm:p-10">
          <p className="font-heading text-2xl">Nothing to review yet</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Your examination workspace is ready. Examination preparation and
            delivery will be added in the next phase.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
