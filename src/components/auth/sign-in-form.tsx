"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError("Email or password is incorrect.");
        return;
      }

      router.replace(result.redirectTo);
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block space-y-2 text-sm font-medium">
        <span>Email address</span>
        <input
          autoComplete="email"
          className="h-12 w-full rounded-md border border-input bg-background px-4 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        <span>Password</span>
        <input
          autoComplete="current-password"
          className="h-12 w-full rounded-md border border-input bg-background px-4 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          name="password"
          required
          type="password"
        />
      </label>
      {error && (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        className="flex h-12 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
