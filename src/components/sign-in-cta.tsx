"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";

export function SignInCta({ message, className }: { message: string; className?: string }) {
  const prompt = useAuthPrompt();
  return (
    <div className={cn("rounded-3xl border border-border bg-card p-10 text-center", className)}>
      <p className="font-display text-xl font-semibold">{message}</p>
      <Button className="mt-6" size="lg" onClick={() => prompt(message)}>
        Sign in
      </Button>
    </div>
  );
}
