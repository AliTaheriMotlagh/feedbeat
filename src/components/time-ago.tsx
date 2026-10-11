"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/utils";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * Relative timestamp ("3 days ago"). Renders a stable absolute date on the
 * server (prerender-safe, no hydration mismatch) and upgrades after mount.
 */
export function TimeAgo({ date, className }: { date: Date | string; className?: string }) {
  const d = new Date(date);
  const [label, setLabel] = useState(() => fmt.format(d));
  const iso = d.toISOString();

  useEffect(() => {
    const update = () => setLabel(timeAgo(iso));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [iso]);

  return (
    <time dateTime={iso} title={fmt.format(d)} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
