import { Heart, Music2 } from "lucide-react";
import Link from "next/link";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { formatCompact, plural } from "@/lib/utils";
import { Avatar } from "./avatar";
import { PlatformIcon } from "./platform-icon";

export interface PlaylistCardData {
  id: string;
  platform: PlatformId;
  trackCount: number;
  likeCount: number;
  coverUrl: string | null;
  handle: string;
  name: string | null;
  avatarUrl: string | null;
}

export function PlaylistCard({ p, priority }: { p: PlaylistCardData; priority?: boolean }) {
  const platform = PLATFORMS[p.platform];
  return (
    <Link
      href={`/u/${p.handle.toLowerCase()}/${platform.slug}`}
      className="group block rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-violet-500/10"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- third-party artwork
          <img
            src={p.coverUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center" style={{ background: `${platform.color}22` }}>
            <Music2 className="size-10 text-muted-foreground" />
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <PlatformIcon platform={p.platform} colored className="size-3.5" />
          {platform.name}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Avatar src={p.avatarUrl} name={p.handle} className="size-7" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.name ?? `@${p.handle}`}</p>
          <p className="truncate text-xs text-muted-foreground">@{p.handle}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{plural(p.trackCount, "song")}</span>
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3" /> {formatCompact(p.likeCount)}
        </span>
      </div>
    </Link>
  );
}
