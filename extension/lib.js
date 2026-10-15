/*
 * Shared helpers for the Feedbeat collector extension.
 * A plain classic script so it runs in content scripts, the service worker
 * and unit tests alike, so everything hangs off one global.
 */
(function (root) {
  "use strict";

  // Keep in sync with host_permissions and content_scripts in manifest.json.
  const SITE_ORIGINS = ["https://feedbeat.app", "http://localhost:3000"];
  const SITE_URL = SITE_ORIGINS[0];

  // Pre-filter only: the server re-parses every link with its own rules.
  const MUSIC_HOSTS = [
    "open.spotify.com",
    "spotify.link",
    "spoti.fi",
    "youtube.com",
    "youtu.be",
    "music.youtube.com",
    "music.apple.com",
    "itunes.apple.com",
    "apple.co",
    "soundcloud.com",
    "on.soundcloud.com",
    "deezer.com",
    "link.deezer.com",
    "deezer.page.link",
    "tidal.com",
    "listen.tidal.com",
    "tidal.link",
    "bandcamp.com",
  ];

  function isMusicUrl(raw) {
    let host;
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      return false;
    }
    return MUSIC_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  }

  /** "open.spotify.com/track/…" or "https://…" → absolute https URL, or null. */
  function toUrl(text) {
    const t = (text ?? "").trim();
    // X truncates long links with an ellipsis, so the visible text is not a full URL.
    if (!t || /\s/.test(t) || t.endsWith("…")) return null;
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      return new URL(withScheme).href;
    } catch {
      return null;
    }
  }

  /** The logged-in account's numeric id, from X's `twid` cookie ("u%3D12345"). */
  function accountIdFromTwid(value) {
    let decoded;
    try {
      decoded = decodeURIComponent(value ?? "");
    } catch {
      return null;
    }
    const m = /u=(\d{1,25})/.exec(decoded);
    return m ? m[1] : null;
  }

  root.FeedbeatLib = { SITE_URL, SITE_ORIGINS, isMusicUrl, toUrl, accountIdFromTwid };
})(globalThis);
