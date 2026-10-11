import { after, NextResponse } from "next/server";
import { z } from "zod";
import { features } from "@/env";
import { getSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { requestScan, runScan } from "@/server/scan";
import { touchStreak } from "@/server/xp";

// Scans run after the response is sent (via `after`), within this budget.
export const maxDuration = 300;

const body = z.object({ handle: z.string().min(1).max(64) });

export async function POST(req: Request) {
  if (!features.scanning) {
    return NextResponse.json({ error: "Scanning is temporarily unavailable." }, { status: 503 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter an X handle." }, { status: 400 });

  const session = await getSession();
  const userId = session?.user.id ?? null;

  // Signed-in curators get a bigger allowance than anonymous visitors.
  const { success, reset } = userId
    ? await rateLimit("scan:user", userId, 10, "1 h")
    : await rateLimit("scan:ip", await clientIp(), 3, "1 h");
  if (!success) {
    return NextResponse.json(
      { error: userId ? "You've hit the hourly scan limit. Try again soon." : "Sign in to scan more profiles." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) } },
    );
  }

  const result = await requestScan(parsed.data.handle, userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  if (result.started) after(() => runScan(result.profile.id));
  if (userId) after(() => touchStreak(userId));

  return NextResponse.json({
    handle: result.profile.handle,
    started: result.started,
    isNewDiscovery: Boolean(userId) && result.started && !result.profile.lastScannedAt && result.profile.discoveredById === userId,
  });
}
