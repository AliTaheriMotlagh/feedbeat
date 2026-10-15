import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/server/rate-limit";
import { fetchArchiveRange, RemoteArchiveError } from "@/server/remote-archive";

// One ≤4 MB byte range per call; the browser stitches them together.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to import from a link." }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  const range = /^bytes=(\d{1,15})-(\d{1,15})$/.exec(req.headers.get("range") ?? "");
  if (!url || !range) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // A typical archive needs ~5–30 ranges; this leaves room for retries and big histories.
  const limit = await rateLimit("import:link", session.user.id, 400, "1 h");
  if (!limit.success) return NextResponse.json({ error: "Too many downloads — try again in a bit." }, { status: 429 });

  try {
    const { body, contentRange } = await fetchArchiveRange(url, Number(range[1]), Number(range[2]));
    return new Response(body, {
      status: 206,
      headers: { "Content-Range": contentRange, "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof RemoteArchiveError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[archive-proxy]", err);
    return NextResponse.json({ error: "Couldn't download from that link." }, { status: 502 });
  }
}
