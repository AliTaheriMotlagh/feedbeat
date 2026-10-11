import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-fuchsia-500 to-violet-600",
  "from-cyan-400 to-blue-600",
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-teal-600",
  "from-pink-500 to-orange-400",
];

/** Avatar with a deterministic gradient fallback (no layout shift, no broken images). */
export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br text-sm font-bold text-white uppercase",
        GRADIENTS[seed % GRADIENTS.length],
        className,
      )}
    >
      <span aria-hidden>{name.replace(/^@/, "").slice(0, 1)}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatars from many CDNs; tiny & lazy
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
