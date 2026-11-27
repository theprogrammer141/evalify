"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ReportVerificationForm() {
  const router = useRouter();
  const [token, setToken] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(`/verify/${token.trim()}`);
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium" htmlFor="verification-token">
        Verification identifier
        <input
          autoComplete="off"
          className="mt-2 min-h-12 w-full border border-border bg-background px-3 font-mono text-sm tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          id="verification-token"
          maxLength={64}
          minLength={64}
          onChange={(event) => setToken(event.target.value)}
          pattern="[a-f0-9]{64}"
          required
          spellCheck={false}
          value={token}
        />
      </label>
      <p className="text-xs leading-5 text-muted-foreground">
        Enter the 64-character identifier printed beside the QR code on the
        issued report.
      </p>
      <button
        className="inline-flex min-h-11 items-center justify-center bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        type="submit"
      >
        Verify report
      </button>
    </form>
  );
}
