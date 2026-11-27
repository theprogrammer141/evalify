import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requirePageRole } from "@/lib/auth/authorization";
import { listAdminMonitorableExaminations } from "@/lib/monitoring/service";

export const instant = false;

function formatSchedule(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export default async function AdminExaminationsPage() {
  const user = await requirePageRole("ADMIN");
  const examinations = await listAdminMonitorableExaminations();

  return (
    <AppShell user={user}>
      <div className="space-y-8">
        <header className="max-w-3xl border-b border-border pb-7">
          <p className="text-sm font-medium text-muted-foreground">
            Administrator workspace
          </p>
          <h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            Examination monitoring
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Open operational records for published examinations across the platform.
          </p>
        </header>

        {examinations.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {examinations.map((examination) => (
              <li className="py-5" key={examination.id}>
                <Link
                  className="group grid gap-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  href={`/examiner/examinations/${examination.id}/monitor`}
                >
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-xl group-hover:underline">
                      {examination.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Examiner {examination.examinerEmail}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSchedule(examination.startsAt)} UTC –{" "}
                      {formatSchedule(examination.endsAt)} UTC
                    </p>
                  </div>
                  <span className="min-h-11 content-center text-sm font-semibold">
                    Open monitoring
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-border py-8 text-sm text-muted-foreground">
            No published examinations are available to monitor.
          </p>
        )}
      </div>
    </AppShell>
  );
}
