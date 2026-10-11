import { z } from "zod";

/**
 * Typed, validated environment. Optional integrations degrade gracefully:
 * - no X_BEARER_TOKEN  → handle scanning uses demo data in development, disabled in production
 *                         (X archive import works everywhere and is free)
 * - no SPOTIFY_*       → "Export to Spotify" is hidden
 * - no Upstash/KV      → in-memory rate limiting (per instance)
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),

  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),

  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),

  // Free sign-in options
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),

  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  CRON_SECRET: z.string().optional(),
  SCAN_MAX_TWEETS: z.coerce.number().int().min(100).max(3200).default(800),
  DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

/** Demo data is used when explicitly enabled, or in dev without X credentials. */
export const useDemoTweets = env.DEMO_MODE || (!env.X_BEARER_TOKEN && env.NODE_ENV !== "production");

export type LoginProvider = "github" | "google" | "twitter";

const loginProviders: LoginProvider[] = [];
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) loginProviders.push("github");
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) loginProviders.push("google");
if (env.X_CLIENT_ID && env.X_CLIENT_SECRET) loginProviders.push("twitter");

/** Better Auth refuses to run in production without a secret. */
const authConfigured = Boolean(env.BETTER_AUTH_SECRET) || env.NODE_ENV !== "production";
if (!authConfigured) console.warn("⚠️ BETTER_AUTH_SECRET is not set — sign-in is disabled.");

export const features = {
  /** Sign-in works: a secret plus at least one provider. */
  auth: authConfigured && loginProviders.length > 0,
  loginProviders: authConfigured ? loginProviders : [],
  xLogin: loginProviders.includes("twitter"),
  spotifyExport: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
  scanning: Boolean(env.X_BEARER_TOKEN) || useDemoTweets,
};
