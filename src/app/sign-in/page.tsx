import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/authorization";

export const instant = false;

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex flex-col justify-between bg-[#182d2b] px-8 py-8 text-white sm:px-14 sm:py-12">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center border border-white/30 font-heading text-lg">
            S
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.22em]">
            SEMS
          </span>
        </div>
        <div className="max-w-xl py-20 lg:py-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Secure examination management
          </p>
          <h1 className="mt-6 font-heading text-5xl leading-[1.08] tracking-tight sm:text-6xl">
            Every assessment, handled with care.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/70">
            A clear, reliable workspace for the people who organize, assess and
            take examinations.
          </p>
        </div>
        <p className="text-xs text-white/50">
          Authorized accounts only · No public registration
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Welcome back
          </p>
          <h2 className="mt-3 font-heading text-3xl">Sign in to SEMS</h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">
            Use the account details provided by your administrator.
          </p>
          <SignInForm />
        </div>
      </section>
    </main>
  );
}
