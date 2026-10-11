import { cn } from "@/lib/utils";

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-linear-to-r from-fuchsia-500 via-violet-500 to-cyan-500 transition-[width] duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
