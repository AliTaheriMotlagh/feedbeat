import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env, features } from "@/env";
import { site } from "@/lib/site";

/** Vercel serves the same deployment on several hostnames; trust all of them. */
const trustedOrigins = [env.BETTER_AUTH_URL, site.url, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter((o): o is string => Boolean(o))
  .map((o) => (o.startsWith("http") ? o : `https://${o}`));

// `next dev` moves to another port when 3000 is taken, and sign-in is refused ("Invalid origin") from any origin not listed here.
if (env.NODE_ENV !== "production") trustedOrigins.push("http://localhost:*", "http://127.0.0.1:*");

const createAuth = () =>
  betterAuth({
    appName: site.name,
    baseURL: env.BETTER_AUTH_URL ?? site.url,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    // Works with only BETTER_AUTH_SECRET: no OAuth app or external mail service needed.
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    socialProviders: {
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
              mapProfileToUser: (profile) => ({ username: profile.login }),
            },
          }
        : {}),
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" as const } }
        : {}),
      ...(env.X_CLIENT_ID && env.X_CLIENT_SECRET
        ? {
            twitter: {
              clientId: env.X_CLIENT_ID,
              clientSecret: env.X_CLIENT_SECRET,
              mapProfileToUser: (profile) => ({
                username: profile.data.username,
                image: profile.data.profile_image_url?.replace("_normal", "_400x400"),
              }),
            },
          }
        : {}),
      ...(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET
        ? {
            spotify: {
              clientId: env.SPOTIFY_CLIENT_ID,
              clientSecret: env.SPOTIFY_CLIENT_SECRET,
              scope: ["playlist-modify-public", "playlist-modify-private"],
              // Spotify is only linked to existing accounts for exporting.
              disableSignUp: true,
            },
          }
        : {}),
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["github", "google", "twitter", "spotify"], allowDifferentEmails: true },
    },
    user: {
      additionalFields: {
        username: { type: "string", required: false, input: false },
        xp: { type: "number", required: false, defaultValue: 0, input: false },
        streak: { type: "number", required: false, defaultValue: 0, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Every curator gets a unique, URL-safe username for /c/[username].
          before: async (data) => ({ data: { ...data, username: await uniqueUsername(String(data.username ?? data.name ?? "")) } }),
        },
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: { enabled: true },
    plugins: [nextCookies()],
  });

type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

let instance: Auth | null = null;

/**
 * The Better Auth instance, or null when auth isn't configured (e.g. missing
 * BETTER_AUTH_SECRET in production). Created lazily so a misconfiguration
 * degrades to "signed out" instead of crashing every request.
 */
export function getAuth(): Auth | null {
  if (!features.auth) return null;
  return (instance ??= createAuth());
}

async function uniqueUsername(seed: string) {
  const base =
    seed
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9_]+/g, "")
      .slice(0, 20) || "curator";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 10_000)}`;
    const [taken] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.username, candidate));
    if (!taken) return candidate;
  }
  return `${base}${crypto.randomUUID().slice(0, 8)}`;
}

/** Current session (deduped per request). */
export const getSession = cache(async () => {
  const auth = getAuth();
  if (!auth) return null;
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
});
