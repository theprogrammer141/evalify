"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AttemptEntry({
  examinationId,
  available,
}: {
  examinationId: string;
  available: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/candidate/examinations/${examinationId}/attempt`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Could not check the existing attempt.");
        return (await response.json()) as { attempt: { id: string } };
      })
      .then((result) => {
        if (!active) return;
        if (result?.attempt.id) {
          router.replace(`/candidate/attempt/${result.attempt.id}`);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Could not check the examination server. Try again.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [examinationId, router]);

  async function startAttempt() {
    setError(null);
    setStarting(true);
    try {
      const response = await fetch(
        `/api/v1/candidate/examinations/${examinationId}/attempt`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        attempt?: { id: string };
        error?: string;
      };
      if (!response.ok || !result.attempt) {
        setError(
          result.error === "exam_not_available"
            ? "This examination is no longer available to start."
            : "The examination could not be opened. Try again.",
        );
        return;
      }
      router.replace(`/candidate/attempt/${result.attempt.id}`);
    } catch {
      setError("Connection lost. The examination was not confirmed as started.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <p aria-live="polite" className="flex items-center gap-2 border-t border-border py-6 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        Checking for an existing attempt
      </p>
    );
  }

  return (
    <section className="border-t border-border pt-6">
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Your answers are recorded by the examination server. The deadline
        continues during connection interruptions.
      </p>
      {available ? (
        <Button
          className="mt-5"
          disabled={starting}
          onClick={() => void startAttempt()}
          type="button"
        >
          {starting ? "Opening examination…" : "Start examination"}
          <ArrowRight aria-hidden="true" data-icon="inline-end" />
        </Button>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          This examination is not available to start right now.
        </p>
      )}
    </section>
  );
}
