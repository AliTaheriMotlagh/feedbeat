/**
 * Archive links: turn what people paste (share pages, direct links) into a
 * URL that serves the raw .zip bytes and supports HTTP Range requests.
 */

/** Largest byte range one proxy call returns — under Vercel's 4.5 MB response cap. */
export const MAX_RANGE_BYTES = 4 * 1024 * 1024;

export class ArchiveUrlError extends Error {}

const DRIVE_ID = /^[\w-]{10,}$/;

function googleDriveId(url: URL): string | null {
  if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") return null;
  const id = /\/file\/d\/([\w-]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
  return id && DRIVE_ID.test(id) ? id : null;
}

export function normalizeArchiveUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ArchiveUrlError("That doesn't look like a link.");
  }
  if (url.href.length > 2048) throw new ArchiveUrlError("That link is too long.");
  if (url.protocol !== "https:") throw new ArchiveUrlError("Use an https:// link.");
  if (url.username || url.password) throw new ArchiveUrlError("Links with a username or password aren't supported.");
  if (url.port && url.port !== "443") throw new ArchiveUrlError("Links on custom ports aren't supported.");
  url.hash = "";

  // Dropbox share pages → the file itself.
  if (url.hostname === "dropbox.com" || url.hostname.endsWith(".dropbox.com")) {
    url.searchParams.delete("raw");
    url.searchParams.set("dl", "1");
    return url.href;
  }

  // Google Drive share pages → the direct download (skipping the virus-scan page).
  const driveId = googleDriveId(url);
  if (driveId) return `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;

  return url.href;
}
