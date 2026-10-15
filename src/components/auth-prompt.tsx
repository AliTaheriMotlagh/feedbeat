"use client";

import { Dialog } from "radix-ui";
import { X as Close } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LoginProvider } from "@/env";
import { signInWith, signInWithEmail, signUpWithEmail } from "@/lib/auth-client";
import { LogoMark } from "./logo";
import { BrandIcon } from "./platform-icon";

const LABELS: Record<LoginProvider, { label: string; brand: "github" | "google" | "x" }> = {
  github: { label: "Continue with GitHub", brand: "github" },
  google: { label: "Continue with Google", brand: "google" },
  twitter: { label: "Continue with X", brand: "x" },
};

const Ctx = createContext<(message?: string) => void>(() => {});

export const useAuthPrompt = () => useContext(Ctx);

/** App-wide "sign in to continue" dialog, opened from any gated interaction. */
export function AuthPromptProvider({
  children,
  providers,
  emailLogin,
}: {
  children: React.ReactNode;
  providers: LoginProvider[];
  emailLogin: boolean;
}) {
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
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-popover p-6 text-center shadow-2xl">
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

            {emailLogin ? <EmailForm /> : null}

            {providers.length ? (
              <div className="mt-6 space-y-2">
                {emailLogin ? <p className="text-xs text-muted-foreground">or</p> : null}
                {providers.map((p) => (
                  <Button
                    key={p}
                    className="w-full"
                    size="lg"
                    variant="outline"
                    onClick={() => signInWith(p, window.location.pathname + window.location.search)}
                  >
                    <BrandIcon brand={LABELS[p].brand} /> {LABELS[p].label}
                  </Button>
                ))}
              </div>
            ) : null}

            {!emailLogin && !providers.length ? (
              <p className="mt-6 rounded-xl bg-muted p-3 text-xs text-muted-foreground">Sign-in isn&apos;t configured on this deployment yet.</p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">We never post on your behalf.</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  );
}

/** Email + password, with a sign-in / create-account toggle. Reloads the page on success so the session refreshes. */
function EmailForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const action = mode === "signin" ? signInWithEmail : signUpWithEmail;
      const { error: err } = await action(email.trim(), password);
      if (err) {
        setError(err.message ?? "Something went wrong. Try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  const signup = mode === "signup";

  return (
    <form onSubmit={submit} className="mt-6 space-y-2 text-left">
      <Input
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        name="password"
        autoComplete={signup ? "new-password" : "current-password"}
        required
        minLength={8}
        placeholder={signup ? "Password (8+ characters)" : "Password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
      </Button>
      <p className="pt-1 text-center text-xs text-muted-foreground">
        {signup ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4"
          onClick={() => {
            setMode(signup ? "signin" : "signup");
            setError(undefined);
          }}
        >
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}
