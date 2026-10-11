import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { site } from "@/lib/site";

export const auth = betterAuth({
  appName: site.name,
  baseURL: env.BETTER_AUTH_URL ?? site.url,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  socialProviders: {
    ...(env.X_CLIENT_ID && env.X_CLIENT_SECRET
      ? {
          twitter: {
            clientId: env.X_CLIENT_ID,
            clientSecret: env.X_CLIENT_SECRET,
            mapProfileToUser: (profile) => ({
              username: profile.data.username.toLowerCase(),
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
    accountLinking: { enabled: true, trustedProviders: ["twitter", "spotify"], allowDifferentEmails: true },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      xp: { type: "number", required: false, defaultValue: 0, input: false },
      streak: { type: "number", required: false, defaultValue: 0, input: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: { enabled: true },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** Current session (deduped per request). */
export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
});
