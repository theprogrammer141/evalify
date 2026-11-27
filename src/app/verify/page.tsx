import Link from "next/link";
import { ReportVerificationForm } from "@/components/examinations/report-verification-form";

export const instant = false;

export default function ReportVerificationEntryPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl border border-border bg-background p-6 sm:p-10">
        <Link
          className="text-sm font-semibold tracking-wide text-primary"
          href="/"
        >
          EVALIFY
        </Link>
        <p className="mt-10 text-sm font-medium text-muted-foreground">
          Public report verification
        </p>
        <h1 className="mt-2 font-heading text-3xl tracking-tight sm:text-4xl">
          Check a report identifier
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Scan the report&apos;s QR code to verify it directly, or enter its
          identifier below.
        </p>
        <ReportVerificationForm />
      </div>
    </main>
  );
}
