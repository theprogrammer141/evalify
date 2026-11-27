import { SignOutButton } from "@/components/auth/sign-out-button";
import Image from "next/image";
import type { AuthenticatedUser } from "@/lib/auth/session";
import Link from "next/link";
import type { ReactNode } from "react";

const roleLabels = {
  ADMIN: "Administrator",
  EXAMINER: "Examiner",
  CANDIDATE: "Candidate",
};

const workspaceLinks = {
  ADMIN: [
    { href: "/admin", label: "User accounts" },
    { href: "/admin/examinations", label: "Examination monitoring" },
  ],
  EXAMINER: [
    { href: "/examiner", label: "Examinations" },
    { href: "/examiner/questions", label: "Question bank" },
  ],
  CANDIDATE: [{ href: "/candidate", label: "Your examinations" }],
};

export function AppShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex-1 bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col items-start">
            <Image
              alt="Evalify"
              className="h-9 w-auto"
              height={315}
              priority
              src="/evalify-wordmark.png"
              width={1235}
            />
            <p className="ml-1 text-[13px] text-muted-foreground">
              {roleLabels[user.role]}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:flex-1 sm:gap-6">
            <nav
              aria-label="Workspace"
              className="flex flex-wrap items-center justify-end gap-x-3 sm:gap-x-5"
            >
              {workspaceLinks[user.role].map((link) => (
                <Link
                  className="min-h-11 content-center text-[13px] font-medium text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline sm:text-sm"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 border-l border-border pl-3 sm:gap-4 sm:pl-6">
              <span className="hidden max-w-52 truncate text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-14">{children}</div>
    </div>
  );
}
