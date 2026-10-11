import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/db/schema";
import { formatCompact, plural } from "@/lib/utils";
import { Avatar } from "./avatar";

export function ProfileCard({ p }: { p: Pick<Profile, "handle" | "displayHandle" | "name" | "avatarUrl" | "verified" | "trackCount" | "followersCount"> }) {
  return (
    <Link
      href={`/u/${p.handle}`}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-accent/40"
    >
      <Avatar src={p.avatarUrl} name={p.displayHandle} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate font-semibold">
          {p.name ?? p.displayHandle}
          {p.verified && <BadgeCheck className="size-4 shrink-0 text-sky-500" aria-label="Verified" />}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          @{p.displayHandle} · {formatCompact(p.followersCount)} followers
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{plural(p.trackCount, "song")}</span>
    </Link>
  );
}
