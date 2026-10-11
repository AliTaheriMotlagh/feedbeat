import Link from "next/link";
import { PLATFORM_IDS, PLATFORMS } from "@/lib/platforms";
import { site } from "@/lib/site";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border pb-20 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{site.description}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Playlists</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {PLATFORM_IDS.slice(0, 5).map((p) => (
              <li key={p}>
                <Link href={`/explore?platform=${p}`} className="hover:text-foreground">
                  {PLATFORMS[p].name} playlists
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{site.name}</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/about" className="hover:text-foreground">About & FAQ</Link></li>
            <li><Link href="/leaderboard" className="hover:text-foreground">Leaderboard</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          {site.name} is not affiliated with X Corp., Spotify, Google, Apple or any other platform. All trademarks belong to their owners.
        </p>
      </div>
    </footer>
  );
}
