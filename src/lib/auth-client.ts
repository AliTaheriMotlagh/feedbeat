"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

export function signInWith(provider: "github" | "google" | "twitter", callbackURL = "/") {
  return authClient.signIn.social({ provider, callbackURL });
}
