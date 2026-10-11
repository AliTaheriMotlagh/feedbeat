import { and, asc, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { env } from "@/env";
import { requestScan, runScan, RESCAN_AFTER_MS } from "@/server/scan";

export const maxDuration = 300;

/**
 * Vercel Cron (see vercel.json, daily — the Hobby plan maximum): keeps the most-followed profiles fresh.
 * Protected by CRON_SECRET, which Vercel sends as a bearer token.
 */
export async function GET(req: Request) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Refreshing needs the (paid) X API; free deployments rely on archive re-imports.
  if (!env.X_BEARER_TOKEN) return NextResponse.json({ refreshed: 0, skipped: "no X API token" });

  const stale = await db
    .select({ handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        eq(profiles.status, "ready"),
        eq(profiles.source, "x_api"),
        eq(profiles.hidden, false),
        gt(profiles.followerCount, 0),
        lt(profiles.lastScannedAt, new Date(Date.now() - 4 * RESCAN_AFTER_MS)),
      ),
    )
    .orderBy(asc(profiles.lastScannedAt))
    .limit(10);

  let refreshed = 0;
  for (const { handle } of stale) {
    const r = await requestScan(handle, null);
    if (r.ok && r.started) {
      await runScan(r.profile.id);
      refreshed++;
    }
  }
  return NextResponse.json({ refreshed });
}
