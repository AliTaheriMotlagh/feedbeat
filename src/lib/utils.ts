import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(date: Date | string, now = Date.now()) {
  const seconds = (new Date(date).getTime() - now) / 1000;
  for (const [unit, s] of UNITS) {
    if (Math.abs(seconds) >= s) return rtf.format(Math.round(seconds / s), unit);
  }
  return "just now";
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? word : pluralWord}`;
}
