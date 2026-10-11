import Link from "next/link";
import { BADGES, type BadgeId } from "@/lib/gamification";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cachedActivity } from "@/server/cached";
import { Avatar } from "./avatar";
import { TimeAgo } from "./time-ago";

export async function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const items = await cachedActivity(limit);
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        It&apos;s quiet… for now. Activity from the community shows up here.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((a) => {
        const actor = a.actor?.name ?? "Someone";
        const actorEl = a.actor?.username ? (
          <Link href={`/c/${a.actor.username}`} className="font-semibold hover:underline">
            {actor}
          </Link>
        ) : (
          <span className="font-semibold">{actor}</span>
        );
        const handle = a.profileHandle;
        const profileEl = handle && (
          <Link href={`/u/${handle.toLowerCase()}`} className="font-semibold hover:underline">
            @{handle}
          </Link>
        );
        const platform = a.playlistPlatform as PlatformId | null;
        const playlistEl =
          handle && platform ? (
            <Link href={`/u/${handle.toLowerCase()}/${platform}`} className="font-semibold hover:underline">
              @{handle}&apos;s {PLATFORMS[platform].name} playlist
            </Link>
          ) : (
            profileEl
          );

        let text: React.ReactNode;
        let emoji = "🎵";
        switch (a.type) {
          case "discover":
            emoji = "🧭";
            text = (
              <>
                {actorEl} discovered {profileEl}
                {a.meta && Number(a.meta) > 0 ? ` — ${a.meta} songs` : ""}
              </>
            );
            break;
          case "like":
            emoji = "❤️";
            text = (
              <>
                {actorEl} liked {playlistEl}
              </>
            );
            break;
          case "comment":
            emoji = "💬";
            text = (
              <>
                {actorEl} commented on {playlistEl}
              </>
            );
            break;
          case "follow":
            emoji = "➕";
            text = (
              <>
                {actorEl} started following {profileEl}
              </>
            );
            break;
          case "badge": {
            const badge = BADGES[a.meta as BadgeId];
            emoji = badge?.emoji ?? "🏅";
            text = (
              <>
                {actorEl} earned the <strong>{badge?.name ?? "a"}</strong> badge
              </>
            );
            break;
          }
        }

        return (
          <li key={a.id} className="flex items-start gap-3 rounded-xl p-2.5 text-sm hover:bg-accent/40">
            <span className="relative">
              <Avatar src={a.actor?.image} name={actor} className="size-8" />
              <span aria-hidden className="absolute -right-1 -bottom-1 text-xs">
                {emoji}
              </span>
            </span>
            <p className="min-w-0 flex-1 leading-snug">
              {text}
              <TimeAgo date={a.createdAt} className="block text-xs text-muted-foreground" />
            </p>
          </li>
        );
      })}
    </ul>
  );
}
