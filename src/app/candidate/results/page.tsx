import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth/authorization";
import { listCandidateIssuedReports } from "@/lib/reports/service";

export const instant = false;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function CandidateResultsPage() {
  const user = await requirePageRole("CANDIDATE");
  const reports = await listCandidateIssuedReports(user.id);

  return (
    <AppShell user={user}>
      <section className="space-y-8">
        <header className="border-b border-border pb-8">
          <p className="text-sm font-medium text-muted-foreground">
            Candidate workspace
          </p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight sm:text-5xl">
            Your result reports
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Download official reports issued for your published examination results.
          </p>
        </header>

        {reports.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {reports.map((report) => (
              <li
                className="grid gap-4 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={report.id}
              >
                <div className="min-w-0">
                  <h2 className="break-words font-heading text-xl">
                    {report.examinationTitle}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Published result: {report.totalMarks} / {report.maximumMarks} marks
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Issued {formatDate(report.issuedAt)} UTC
                  </p>
                </div>
                {report.status === "VALID" ? (
                  <a
                    className="inline-flex min-h-11 items-center justify-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={`/api/v1/candidate/reports/${report.id}/pdf`}
                  >
                    Download result PDF
                  </a>
                ) : (
                  <span className="w-fit border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive">
                    Report revoked
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-y border-border py-12">
            <h2 className="font-heading text-2xl">No reports issued yet</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Official reports appear here after an examiner publishes your result
              and issues its report.
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              href="/candidate"
            >
              Return to examinations
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
