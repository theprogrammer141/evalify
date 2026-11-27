import { SignOutButton } from "@/components/auth/sign-out-button";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { ReactNode } from "react";

const roleLabels = {
  ADMIN: "Administrator",
  EXAMINER: "Examiner",
  CANDIDATE: "Candidate",
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center bg-[#182d2b] font-heading text-lg text-white">
              S
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                SEMS
              </p>
              <p className="text-xs text-muted-foreground">
                {roleLabels[user.role]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
    </div>
  );
}
