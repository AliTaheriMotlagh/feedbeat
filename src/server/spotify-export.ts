import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { account, playlists, profiles, tracks } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { absoluteUrl, site } from "@/lib/site";

export class ExportError extends Error {
  constructor(
    message: string,
    public code: "not_linked" | "not_found" | "empty" | "spotify",
  ) {
    super(message);
  }
}

async function spotify<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new ExportError(`Spotify returned ${res.status}`, "spotify");
  return (await res.json()) as T;
}

/** Copy a Feedbeat Spotify playlist into the user's own Spotify library. */
export async function exportPlaylistToSpotify(userId: string, playlistId: string): Promise<string> {
  const [linked] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "spotify")));
  if (!linked) throw new ExportError("Connect your Spotify account first.", "not_linked");

  let accessToken: string | undefined;
  try {
    // Refreshes the token automatically when it has expired.
    const auth = getAuth();
    if (!auth) throw new Error("auth disabled");
    ({ accessToken } = await auth.api.getAccessToken({ body: { accountId: linked.id, userId } }));
  } catch {
    throw new ExportError("Your Spotify connection expired — please reconnect.", "not_linked");
  }
  if (!accessToken) throw new ExportError("Connect your Spotify account first.", "not_linked");

  const [row] = await db
    .select({ handle: profiles.displayHandle, name: profiles.name })
    .from(playlists)
    .innerJoin(profiles, eq(profiles.id, playlists.profileId))
    .where(and(eq(playlists.id, playlistId), eq(playlists.platform, "spotify")));
  if (!row) throw new ExportError("Playlist not found.", "not_found");

  const items = await db
    .select({ externalId: tracks.externalId })
    .from(tracks)
    .where(and(eq(tracks.playlistId, playlistId), eq(tracks.kind, "track")))
    .orderBy(desc(tracks.tweetedAt));
  const uris = items.map((t) => `spotify:track:${t.externalId.split(":")[1]}`);
  if (!uris.length) throw new ExportError("This playlist has no individual tracks to export.", "empty");

  const created = await spotify<{ id: string; external_urls: { spotify: string } }>(accessToken, "/me/playlists", {
    method: "POST",
    body: JSON.stringify({
      name: `@${row.handle} on ${site.name}`,
      description: `Every Spotify track @${row.handle} shared on X. Made with ${site.name} — ${absoluteUrl(`/u/${row.handle.toLowerCase()}/spotify`)}`,
      public: true,
    }),
  });

  for (let i = 0; i < uris.length; i += 100) {
    await spotify(accessToken, `/playlists/${created.id}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  return created.external_urls.spotify;
}

