"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

export function signInWithX(callbackURL = "/") {
  return authClient.signIn.social({ provider: "twitter", callbackURL });
}
