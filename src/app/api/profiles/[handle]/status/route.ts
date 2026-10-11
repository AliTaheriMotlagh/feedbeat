import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export async function GET(_req: Request, ctx: RouteContext<"/api/profiles/[handle]/status">) {
  const { handle } = await ctx.params;
  const [p] = await db
    .select({ status: profiles.status, message: profiles.statusMessage, trackCount: profiles.trackCount })
    .from(profiles)
    .where(eq(profiles.handle, handle.toLowerCase()));
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p, { headers: { "Cache-Control": "no-store" } });
}
