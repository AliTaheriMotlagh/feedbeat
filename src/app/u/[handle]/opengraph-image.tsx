import { imageData, ogCard, OG_SIZE } from "@/lib/og";
import { PLATFORMS } from "@/lib/platforms";
import { site } from "@/lib/site";
import { plural } from "@/lib/utils";
import { cachedProfileMeta } from "@/server/cached";

export const alt = `Music playlists on ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await cachedProfileMeta(handle);
  if (!data) {
    return ogCard({ eyebrow: "Not mapped yet", title: `@${handle}'s music`, subtitle: `Discover it first on ${site.name}` });
  }
  const { profile, playlists } = data;
  return ogCard({
    eyebrow: `@${profile.displayHandle}`,
    title: `${profile.name ?? profile.displayHandle}'s music`,
    subtitle: `${plural(profile.trackCount, "song")} · ${playlists.map((p) => PLATFORMS[p.platform].name).join(" · ") || "Playlists"}`,
    image: await imageData(profile.avatarUrl),
  });
}
