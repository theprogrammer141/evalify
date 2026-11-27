import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ExaminationSettingsForm } from "@/components/examinations/examination-setup";
import { requirePageRole } from "@/lib/auth/authorization";

export const instant = false;

export default async function NewExaminationPage() {
  const user = await requirePageRole("EXAMINER");

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <div>
          <Link
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href="/examiner"
          >
            Back to examinations
          </Link>
          <p className="mt-8 text-sm font-medium text-muted-foreground">
            New examination
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight sm:text-5xl">
            Create a draft
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Set the instructions, availability window and duration. Add
            questions and candidates after the draft is saved.
          </p>
        </div>
        <ExaminationSettingsForm />
      </div>
    </AppShell>
  );
}
