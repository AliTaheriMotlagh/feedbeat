import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

function notConfigured(req: Request) {
  // The client polls the session; answer "signed out" instead of erroring.
  if (new URL(req.url).pathname.endsWith("/get-session")) return NextResponse.json(null);
  return NextResponse.json({ error: "Sign-in is not configured on this deployment." }, { status: 503 });
}

export async function GET(req: Request) {
  const auth = getAuth();
  return auth ? toNextJsHandler(auth).GET(req) : notConfigured(req);
}

export async function POST(req: Request) {
  const auth = getAuth();
  return auth ? toNextJsHandler(auth).POST(req) : notConfigured(req);
}
