import { redirect } from "next/navigation";
import Image from "next/image";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/authorization";

export const instant = false;

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role));

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-2">
      <section className="flex min-h-[400px] flex-col justify-between bg-primary px-6 py-8 text-primary-foreground sm:min-h-[440px] sm:px-12 lg:min-h-screen lg:px-16 lg:py-12">
        <div className="w-full max-w-[264px] rounded-xl bg-white p-2">
          <Image
            alt="Evalify — Assessment, simplified."
            className="h-auto w-full"
            height={315}
            priority
            sizes="(max-width: 640px) 264px, 264px"
            src="/evalify-logo.png"
            width={1235}
          />
        </div>
        <div className="max-w-xl py-10 lg:py-0">
          <p className="text-[13px] font-medium text-primary-foreground">
            Secure examination management
          </p>
          <h1 className="mt-5 font-heading text-4xl leading-[1.08] tracking-tight sm:text-5xl">
            Every assessment, handled with care.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground">
            A reliable workspace for the people who organize, assess and take
            examinations.
          </p>
        </div>
        <p className="text-[13px] text-primary-foreground">
          Authorized accounts only · No public registration
        </p>
      </section>
      <section className="flex items-center justify-center bg-background px-6 py-10 sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
        <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-6 sm:p-8 lg:p-10">
          <p className="text-[13px] font-medium text-muted-foreground">
            Welcome back
          </p>
          <h2 className="mt-3 font-heading text-2xl sm:text-3xl">
            Sign in to Evalify
          </h2>
          <p className="mb-7 mt-3 text-sm leading-6 text-muted-foreground">
            Use the account details provided by your administrator.
          </p>
          <SignInForm />
        </div>
      </section>
    </main>
  );
}
