"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect } from "react";

// NOTE: Next.js renders this when the root layout (or anything above the segment
// error boundary) throws. Keep it dependency-light: no AppShell / no router
// hooks (usePathname etc.), because those contexts may be unavailable.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ marginBottom: 16, opacity: 0.8 }}>
          The app hit an unexpected error. You can try reloading.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.2)",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.2)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Home
          </a>
        </div>

        <details style={{ whiteSpace: "pre-wrap" }}>
          <summary style={{ cursor: "pointer" }}>Details</summary>
          <pre style={{ marginTop: 12 }}>{String(error?.stack || error)}</pre>
          {error?.digest ? (
            <p style={{ marginTop: 12, opacity: 0.8 }}>
              Digest: {error.digest}
            </p>
          ) : null}
        </details>
      </body>
    </html>
  );
}
