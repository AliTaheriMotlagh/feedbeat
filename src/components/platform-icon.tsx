import { siApplemusic, siAudiomack, siBandcamp, siDeezer, siGithub, siGoogle, siMixcloud, siSoundcloud, siSpotify, siTidal, siX, siYoutube } from "simple-icons";
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
  audiomack: siAudiomack,
  mixcloud: siMixcloud,
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

const BRANDS = { x: siX, github: siGithub, google: siGoogle };

export function BrandIcon({ brand, className, title }: IconProps & { brand: keyof typeof BRANDS }) {
  return (
    <svg role={title ? "img" : undefined} aria-hidden={title ? undefined : true} viewBox="0 0 24 24" className={cn("size-4", className)} fill="currentColor">
      {title && <title>{title}</title>}
      <path d={BRANDS[brand].path} />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return <BrandIcon brand="x" {...props} />;
}
