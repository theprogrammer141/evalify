"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/sign-out", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Sign-out request failed.");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Sign out failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition hover:bg-muted disabled:opacity-60"
        disabled={pending}
        onClick={signOut}
        type="button"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <span aria-live="polite" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
