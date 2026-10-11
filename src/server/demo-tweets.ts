import "server-only";
import type { XTweet, XUser } from "./x-api";

/**
 * Deterministic fake timelines for local development (no X API key needed).
 * Only used when `useDemoTweets` is true — never in production unless DEMO_MODE=true.
 */

const LINKS = [
  "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
  "https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3",
  "https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp",
  "https://open.spotify.com/album/4yP0hdKOZPNshxUOjY0cZj",
  "https://open.spotify.com/track/2Fxmhks0bxGSBdJ92vM42m",
  "https://open.spotify.com/track/1zi7xx7UVEFkmKfv06H8x0",
  "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
  "https://youtu.be/kJQP7kiw5Fk",
  "https://www.youtube.com/watch?v=JGwWNGJdvx8",
  "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
  "https://music.youtube.com/watch?v=hTWKbfoikeg",
  "https://www.youtube.com/watch?v=09R8_2nJtjg",
  "https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378615",
  "https://music.apple.com/us/album/bad-guy/1450695723?i=1450695739",
  "https://soundcloud.com/flume/never-be-like-you-feat-kai",
  "https://soundcloud.com/odesza/say-my-name-feat-zyra",
  "https://www.deezer.com/track/3135556",
  "https://www.deezer.com/track/916424",
  "https://tidal.com/browse/track/77646169",
];

const BLURBS = [
  "on repeat all week 🔁",
  "this one never gets old",
  "late night drive essentials",
  "found this gem today",
  "can't stop playing this",
  "the bridge on this 😮‍💨",
  "Friday mood",
  "certified classic",
];

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function demoUser(username: string): XUser {
  const h = hash(username);
  return {
    id: `demo-${h}`,
    username,
    name: username.charAt(0).toUpperCase() + username.slice(1),
    description: "Demo profile — add X_BEARER_TOKEN to scan real timelines.",
    verified: false,
    public_metrics: { followers_count: (h % 90_000) + 120, tweet_count: 3000 },
  };
}

export async function* demoTweets(username: string): AsyncGenerator<XTweet[]> {
  const h = hash(username);
  const picked = LINKS.filter((_, i) => (h >> i) & 1 || i % 3 === h % 3);
  const now = Date.UTC(2026, 9, 1);
  yield picked.map((url, i) => ({
    id: `19${String(h % 1000).padStart(3, "0")}${String(1000 - i).padStart(14, "0")}`,
    text: `${BLURBS[(h + i) % BLURBS.length]} ${url}`,
    created_at: new Date(now - i * 86_400_000 * ((h % 5) + 1)).toISOString(),
    entities: { urls: [{ url, expanded_url: url }] },
  }));
}
