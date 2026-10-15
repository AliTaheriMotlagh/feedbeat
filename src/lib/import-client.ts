/** Shared upload for every import source (zip, link and the browser extension). */

export const IMPORT_CHUNK = 100;

export interface ImportPayload {
  account: { accountId: string; username: string; displayName: string | null };
  profile: { bio: string | null; avatarUrl: string | null };
  tweetsScanned: number;
  items: { url: string; tweetId: string; tweetedAt: string; text: string }[];
}

/** Publish a prepared import: one start call, chunked items, then finish. */
export async function publishImport(payload: ImportPayload, onProgress: (done: number, total: number) => void) {
  const post = async (body: unknown) => {
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Upload failed.");
    return data;
  };

  const { profileId } = (await post({
    phase: "start",
    account: payload.account,
    profile: payload.profile,
    tweetsScanned: payload.tweetsScanned,
  })) as { profileId: string };

  const total = payload.items.length;
  for (let i = 0; i < total; i += IMPORT_CHUNK) {
    await post({ phase: "chunk", profileId, items: payload.items.slice(i, i + IMPORT_CHUNK) });
    onProgress(Math.min(i + IMPORT_CHUNK, total), total);
  }

  return (await post({ phase: "finish", profileId })) as { handle: string; total: number };
}
