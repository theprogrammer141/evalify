"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
        }}
      >
        <main style={{ maxWidth: 480, padding: 32 }}>
          <h1 style={{ fontSize: 28 }}>Evalify is temporarily unavailable</h1>
          <p role="alert" style={{ lineHeight: 1.6 }}>
            Something went wrong while opening the application. Please try again.
          </p>
          <button
            onClick={retry}
            style={{
              background: "#2563eb",
              border: 0,
              borderRadius: 6,
              color: "white",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              marginTop: 12,
              minHeight: 44,
              padding: "0 20px",
            }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
