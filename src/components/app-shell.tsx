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
  ADMIN: [{ href: "/admin", label: "User accounts" }],
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
  const homeHref =
    user.role === "EXAMINER"
      ? "/examiner"
      : user.role === "CANDIDATE"
        ? "/candidate"
        : "/admin";

  return (
    <div className="min-h-screen flex-1 bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex flex-col items-start">
            <Image
              alt="Evalify"
              className="h-9 w-auto"
              height={315}
              priority
              src="/evalify-wordmark.png"
              width={1235}
            />
            <p className="ml-1 text-xs text-muted-foreground">
              {roleLabels[user.role]}
            </p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-6">
            <nav aria-label="Workspace" className="flex items-center gap-5">
              {workspaceLinks[user.role].map((link) => (
                <Link
                  className="min-h-11 content-center text-sm font-medium text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-4 border-l border-border pl-4 sm:pl-6">
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
