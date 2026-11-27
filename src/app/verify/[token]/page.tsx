import Link from "next/link";
import { connection } from "next/server";
import { getPublicReportVerification } from "@/lib/reports/service";

export const instant = false;

type PageProps = { params: Promise<{ token: string }> };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function VerifyReportPage({ params }: PageProps) {
  await connection();
  const { token } = await params;
  const verification = await getPublicReportVerification(token);
  const valid = verification.status === "valid";
  const revoked = verification.status === "revoked";

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
          {valid
            ? "Report verified"
            : revoked
              ? "Report revoked"
              : "Report not found"}
        </h1>
        <p
          className={`mt-5 border-l-2 pl-4 text-sm leading-6 ${
            valid
              ? "border-emerald-600 text-emerald-800"
              : revoked
                ? "border-destructive text-destructive"
                : "border-border text-muted-foreground"
          }`}
        >
          {valid
            ? "This verification identifier matches an official report that is currently valid."
            : revoked
              ? "This identifier belongs to an issued report that is no longer valid."
              : "No issued report matches this verification identifier."}
        </p>

        {verification.status !== "nonexistent" ? (
          <dl className="mt-8 divide-y divide-border border-y border-border">
            <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm text-muted-foreground">Report</dt>
              <dd className="text-sm font-medium">{verification.reportType}</dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm text-muted-foreground">Examination</dt>
              <dd className="break-words text-sm font-medium">
                {verification.examinationTitle}
              </dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm text-muted-foreground">Issued</dt>
              <dd className="text-sm font-medium">
                {formatDate(verification.issuedAt)} UTC
              </dd>
            </div>
          </dl>
        ) : null}
        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          Verification confirms authenticity and status only. It does not provide
          access to the candidate&apos;s result or examination records.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
          href="/verify"
        >
          Verify another report
        </Link>
      </div>
    </main>
  );
}
