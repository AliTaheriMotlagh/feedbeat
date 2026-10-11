import { ogCard, OG_SIZE } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — turn any X profile into playlists`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Spotify · YouTube · Apple Music · SoundCloud",
    title: "Every song they ever posted, one playlist away.",
    subtitle: "Turn any X profile into playlists. Discover, follow, climb the leaderboard.",
  });
}
