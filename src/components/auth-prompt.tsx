"use client";

import { Dialog } from "radix-ui";
import { X as Close } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { signInWithX } from "@/lib/auth-client";
import { LogoMark } from "./logo";
import { XIcon } from "./platform-icon";

const Ctx = createContext<(message?: string) => void>(() => {});

export const useAuthPrompt = () => useContext(Ctx);

/** App-wide "sign in to continue" dialog, opened from any gated interaction. */
export function AuthPromptProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();

  const prompt = useCallback((m?: string) => {
    setMessage(m);
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={prompt}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-popover p-6 text-center shadow-2xl">
            <Dialog.Close className="absolute top-4 right-4 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
              <Close className="size-4" />
            </Dialog.Close>
            <LogoMark className="mx-auto size-12" />
            <Dialog.Title className="mt-4 font-display text-xl font-bold">Join the crew</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {message ?? "Sign in to like, follow, comment and climb the leaderboard."}
            </Dialog.Description>
            <ul className="mt-4 space-y-1 text-left text-sm">
              <li>🧭 +50 XP for every profile you discover first</li>
              <li>🔥 Daily streaks & collectible badges</li>
              <li>🎧 A personal feed of new finds</li>
            </ul>
            {enabled ? (
              <Button className="mt-6 w-full" size="lg" onClick={() => signInWithX(window.location.pathname + window.location.search)}>
                <XIcon /> Continue with X
              </Button>
            ) : (
              <p className="mt-6 rounded-xl bg-muted p-3 text-xs text-muted-foreground">Sign-in isn&apos;t configured on this deployment yet.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">We never post on your behalf.</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
