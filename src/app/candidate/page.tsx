import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth/authorization";

export const instant = false;

export default async function CandidatePage() {
  const user = await requirePageRole("CANDIDATE");

  return (
    <AppShell user={user}>
      <section className="py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Candidate workspace
        </p>
        <h1 className="mt-3 font-heading text-4xl">Your examinations</h1>
        <div className="mt-10 rounded-lg border border-border bg-background p-8 sm:p-10">
          <p className="font-heading text-2xl">No examinations assigned</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Any examinations assigned to your account will appear here.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
