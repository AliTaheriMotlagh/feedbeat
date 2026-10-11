import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { env } from "@/env";

type Window = `${number} ${"s" | "m" | "h"}`;

const redis =
  env.KV_REST_API_URL && env.KV_REST_API_TOKEN ? new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN }) : null;

const limiters = new Map<string, Ratelimit>();
const memory = new Map<string, { count: number; reset: number }>();

function toMs(window: Window) {
  const [n, unit] = window.split(" ") as [string, "s" | "m" | "h"];
  return Number(n) * { s: 1_000, m: 60_000, h: 3_600_000 }[unit];
}

/**
 * Sliding-window rate limit backed by Upstash Redis (Vercel KV),
 * falling back to a per-instance in-memory counter in development.
 */
export async function rateLimit(bucket: string, key: string, limit: number, window: Window) {
  if (redis) {
    const id = `${bucket}:${limit}:${window}`;
    let rl = limiters.get(id);
    if (!rl) {
      rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window), prefix: `rl:${bucket}`, analytics: false });
      limiters.set(id, rl);
    }
    const { success, reset } = await rl.limit(key);
    return { success, reset };
  }

  const now = Date.now();
  const k = `${bucket}:${key}`;
  const entry = memory.get(k);
  if (!entry || entry.reset < now) {
    memory.set(k, { count: 1, reset: now + toMs(window) });
    return { success: true, reset: now + toMs(window) };
  }
  entry.count++;
  return { success: entry.count <= limit, reset: entry.reset };
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}
