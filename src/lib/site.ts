export const site = {
  name: "Feedbeat",
  tagline: "Every song they ever posted, one playlist away.",
  description:
    "Feedbeat turns any X (Twitter) account into ready-to-play playlists for Spotify, YouTube, Apple Music, SoundCloud and more. Discover the music people share, follow curators, climb the leaderboard.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, ""),
  twitter: "@feedbeat",
  keywords: [
    "twitter playlist generator",
    "x playlist",
    "tweets to spotify playlist",
    "youtube playlist from tweets",
    "music discovery",
    "spotify playlist generator",
    "social music",
  ],
} as const;

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
