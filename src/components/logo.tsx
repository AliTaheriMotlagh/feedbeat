import Link from "next/link";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-8 items-end justify-center gap-[3px] rounded-xl bg-linear-to-br from-fuchsia-500 via-violet-500 to-cyan-400 p-1.5 shadow-md shadow-violet-500/30",
        className,
      )}
    >
      {[0.55, 1, 0.75].map((h, i) => (
        <span
          key={i}
          className="w-[4px] origin-bottom rounded-full bg-white motion-safe:animate-equalizer"
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 rounded-lg font-display text-lg font-bold tracking-tight", className)}>
      <LogoMark />
      <span>{site.name}</span>
    </Link>
  );
}
