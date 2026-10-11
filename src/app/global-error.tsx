"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100dvh", background: "#16141c", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 999, border: 0, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
