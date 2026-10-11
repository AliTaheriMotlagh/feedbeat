import { levelFromXp } from "@/lib/gamification";
import { cn } from "@/lib/utils";

export function LevelPill({ xp, className }: { xp: number; className?: string }) {
  const { level, title } = levelFromXp(xp);
  return (
    <span
      title={`${title} · ${xp.toLocaleString("en-US")} XP`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-linear-to-r from-fuchsia-500/15 to-cyan-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-300",
        className,
      )}
    >
      Lv {level}
    </span>
  );
}
