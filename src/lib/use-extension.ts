"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportPayload } from "./import-client";

/** The scan as the Feedbeat Collector extension reports it (extension/lib.js `summarize`). */
export interface ScanSummary {
  handle: string | null;
  status: "idle" | "running" | "cooldown" | "paused" | "done" | "error";
  mode: "all" | "new";
  message: string | null;
  scanned: number;
  songs: number;
  unpublished: number;
  newest: string | null;
  oldest: string | null;
  complete: boolean;
  resumeAt: number | null;
  updatedAt: string | null;
  /** Songs per platform id; "link" counts smart links resolved on publish. */
  platforms: Record<string, number>;
  recent: { url: string; tweetedAt: string }[];
}

type Reply = { ok: true; state?: ScanSummary | null; signedIn?: boolean; batch?: ImportPayload } | { ok: false; error: string };

export type StartKind = "continue" | "new" | "restart";

const TIMEOUT = 20_000;

/**
 * Talk to the extension through its bridge content script (extension/bridge.js).
 * `status` is "missing" when no extension answered.
 */
export function useExtension() {
  const [status, setStatus] = useState<"detecting" | "missing" | "ready">("detecting");
  const [scan, setScan] = useState<ScanSummary | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const pending = useRef(new Map<string, (reply: Reply) => void>());

  const request = useCallback(
    (type: string, payload?: unknown) =>
      new Promise<Reply>((resolve) => {
        const id = crypto.randomUUID();
        pending.current.set(id, resolve);
        window.postMessage({ source: "feedbeat-page", id, type, payload }, window.location.origin);
        setTimeout(() => {
          if (pending.current.delete(id)) resolve({ ok: false, error: "The extension didn't answer. Reload this page and try again." });
        }, TIMEOUT);
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    async function hello() {
      const reply = await request("hello");
      if (!active || !reply.ok) return;
      setStatus("ready");
      setScan(reply.state ?? null);
      setSignedIn(reply.signedIn ?? true);
    }
    function onMessage(e: MessageEvent) {
      if (e.source !== window || e.data?.source !== "feedbeat-extension") return;
      const data = e.data as { type: string; id?: string; state?: ScanSummary | null } & Reply;
      if (data.type === "reply" && data.id) {
        pending.current.get(data.id)?.(data);
        pending.current.delete(data.id);
      } else if (data.type === "state") {
        setScan(data.state ?? null);
      } else if (data.type === "present") {
        void hello();
      }
    }
    window.addEventListener("message", onMessage);
    void hello();
    const timer = setTimeout(() => setStatus((s) => (s === "detecting" ? "missing" : s)), 2500);
    return () => {
      active = false;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [request]);

  /** Run a command; replies carrying a state update the view. Throws with the extension's message. */
  const command = useCallback(
    async (type: string, payload?: unknown) => {
      const reply = await request(type, payload);
      if (!reply.ok) throw new Error(reply.error);
      if (reply.state !== undefined) setScan(reply.state);
      return reply;
    },
    [request],
  );

  return { status, scan, signedIn, command };
}
