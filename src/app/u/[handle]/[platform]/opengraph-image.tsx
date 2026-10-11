import { imageData, ogCard, OG_SIZE } from "@/lib/og";
import { isPlatformId, PLATFORMS } from "@/lib/platforms";
import { site } from "@/lib/site";
import { plural } from "@/lib/utils";
import { cachedPlaylistMeta } from "@/server/cached";

export const alt = `Playlist on ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string; platform: string }> }) {
  const { handle, platform } = await params;
  const data = isPlatformId(platform) ? await cachedPlaylistMeta(handle, platform) : null;
  if (!data || !isPlatformId(platform)) {
    return ogCard({ eyebrow: site.name, title: "Playlist not found", subtitle: "Turn any X profile into playlists" });
  }
  const meta = PLATFORMS[platform];
  const top = data.tracks
    .slice(0, 2)
    .map((t) => t.title)
    .filter(Boolean)
    .join(" · ");
  return ogCard({
    eyebrow: `${meta.name} playlist`,
    title: `@${data.profile.displayHandle}'s ${meta.name} finds`,
    subtitle: `${plural(data.playlist.trackCount, "song")}${top ? ` — ${top}` : ""}`,
    image: (await imageData(data.playlist.coverUrl)) ?? (await imageData(data.profile.avatarUrl)),
    accent: meta.color,
  });
}
