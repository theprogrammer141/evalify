"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center gap-5 px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold">This page is unavailable</h1>
      <ErrorMessage>
        Something went wrong while loading this page. Please try again.
      </ErrorMessage>
      <Button className="w-fit" onClick={retry} type="button">
        Try again
      </Button>
    </main>
  );
}
