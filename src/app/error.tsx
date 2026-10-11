"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden>
        🎚️
      </p>
      <h1 className="mt-4 font-display text-2xl font-bold">Something went off-beat</h1>
      <p className="mt-2 text-muted-foreground">An unexpected error occurred. Please try again.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
