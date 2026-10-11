import { siApplemusic, siBandcamp, siDeezer, siSoundcloud, siSpotify, siTidal, siX, siYoutube } from "simple-icons";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const ICONS = {
  spotify: siSpotify,
  youtube: siYoutube,
  apple: siApplemusic,
  soundcloud: siSoundcloud,
  deezer: siDeezer,
  tidal: siTidal,
  bandcamp: siBandcamp,
} satisfies Record<PlatformId, { path: string }>;

interface IconProps {
  className?: string;
  /** Use the brand color instead of currentColor. */
  colored?: boolean;
  title?: string;
}

export function PlatformIcon({ platform, className, colored, title }: IconProps & { platform: PlatformId }) {
  const fill = colored ? (platform === "tidal" ? "currentColor" : PLATFORMS[platform].color) : "currentColor";
  return (
    <svg
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      viewBox="0 0 24 24"
      className={cn("size-4 shrink-0", className)}
      fill={fill}
    >
      {title && <title>{title}</title>}
      <path d={ICONS[platform].path} />
    </svg>
  );
}

export function XIcon({ className, title }: IconProps) {
  return (
    <svg role={title ? "img" : undefined} aria-hidden={title ? undefined : true} viewBox="0 0 24 24" className={cn("size-4", className)} fill="currentColor">
      {title && <title>{title}</title>}
      <path d={siX.path} />
    </svg>
  );
}
