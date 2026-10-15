"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

export function signInWith(provider: "github" | "google" | "twitter", callbackURL = "/") {
  return authClient.signIn.social({ provider, callbackURL });
}

export function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}

/** Better Auth requires a name; use the part of the email before the "@". */
export function signUpWithEmail(email: string, password: string) {
  return authClient.signUp.email({ email, password, name: email.split("@")[0] || "curator" });
}
