import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { finishImport, ImportError, importChunk, importRequest, startImport } from "@/server/archive-import";
import { rateLimit } from "@/server/rate-limit";

// Each call handles at most one chunk, comfortably inside free-tier limits.
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to publish your playlists." }, { status: 401 });

  const parsed = importRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid import data." }, { status: 400 });

  const body = parsed.data;
  const userId = session.user.id;
  const limit =
    body.phase === "start" ? await rateLimit("import:start", userId, 10, "1 h") : await rateLimit("import:chunk", userId, 200, "1 h");
  if (!limit.success) return NextResponse.json({ error: "Too many imports — try again in a bit." }, { status: 429 });

  try {
    if (body.phase === "start") return NextResponse.json(await startImport(userId, body));
    if (body.phase === "chunk") return NextResponse.json(await importChunk(userId, body));
    return NextResponse.json(await finishImport(userId, body));
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[import]", err);
    return NextResponse.json({ error: "Import failed. Please retry." }, { status: 500 });
  }
}
