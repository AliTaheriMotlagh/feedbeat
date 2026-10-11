"use client";

import { DropdownMenu } from "radix-ui";
import { LogOut, Rss, Trophy, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { signOut, useSession } from "@/lib/auth-client";
import { levelFromXp } from "@/lib/gamification";
import { pingActivity } from "@/server/actions";
import { useAuthPrompt } from "./auth-prompt";
import { Avatar } from "./avatar";

const item =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const prompt = useAuthPrompt();
  const router = useRouter();

  // Keep the daily streak alive (no-op after the first call each day).
  const userId = session?.user.id;
  useEffect(() => {
    if (userId) void pingActivity();
  }, [userId]);

  if (isPending) return <Skeleton className="size-9 rounded-full" />;

  if (!session) {
    return (
      <Button size="sm" onClick={() => prompt()}>
        Sign in
      </Button>
    );
  }

  const u = session.user as typeof session.user & { username?: string | null; xp?: number; streak?: number };
  const lvl = levelFromXp(u.xp ?? 0);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 pr-3 ring-1 ring-border transition hover:bg-accent" aria-label="Account menu">
          <Avatar src={u.image} name={u.name} className="size-8" />
          <span className="hidden text-xs font-bold sm:inline">Lv {lvl.level}</span>
          {(u.streak ?? 0) > 1 && <span className="hidden text-xs sm:inline">🔥{u.streak}</span>}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <div className="p-2.5">
            <p className="truncate font-semibold">{u.name}</p>
            <p className="text-xs text-muted-foreground">
              {lvl.title} · {(u.xp ?? 0).toLocaleString("en-US")} XP
            </p>
            <Progress value={lvl.progress} className="mt-2" label="Progress to next level" />
            <p className="mt-1 text-[11px] text-muted-foreground">{(lvl.next ?? 0) - (u.xp ?? 0)} XP to level {lvl.level + 1}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {u.username && (
            <DropdownMenu.Item asChild className={item}>
              <Link href={`/c/${u.username}`}>
                <User /> My profile
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item asChild className={item}>
            <Link href="/feed">
              <Rss /> My feed
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link href="/leaderboard">
              <Trophy /> Leaderboard
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={item}
            onSelect={async () => {
              await signOut();
              router.refresh();
            }}
          >
            <LogOut /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
