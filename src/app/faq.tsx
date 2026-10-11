import { ChevronDown } from "lucide-react";
import { site } from "@/lib/site";

export const FAQ_ITEMS = [
  {
    q: `How does ${site.name} find music in a timeline?`,
    a: `We read an account's recent public posts (up to the latest few thousand) and look for links to Spotify, YouTube, YouTube Music, Apple Music, SoundCloud, Deezer, TIDAL and Bandcamp — including shortened links and reposts. Each link becomes a track in that platform's playlist.`,
  },
  {
    q: "Is it free?",
    a: `Yes. Browsing, playing and sharing playlists is free. Sign in with X to like, follow, comment, earn XP and save playlists to Spotify.`,
  },
  {
    q: "Can I save a playlist to my own Spotify account?",
    a: `Yes — connect Spotify once and press “Save to Spotify” on any Spotify playlist. For YouTube you can open the whole playlist as a queue with one click, no account needed.`,
  },
  {
    q: "Does it work with private or protected accounts?",
    a: `No. We only read public posts. Protected accounts can't be scanned, and anyone can ask us to remove their profile from ${site.name}.`,
  },
  {
    q: "How often are playlists updated?",
    a: `Anyone can refresh a profile every few hours, and popular profiles are refreshed automatically. Refreshes only fetch new posts, so they're quick.`,
  },
  {
    q: "How do XP and levels work?",
    a: `You earn XP for discovering new profiles (+50, plus a bonus per song found), for likes your discoveries receive, for commenting, sharing and daily visits. XP unlocks levels from Listener to Legend, and milestones unlock badges.`,
  },
];

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Questions, answered
      </h2>
      <div className="mt-10 divide-y divide-border rounded-3xl border border-border bg-card">
        {FAQ_ITEMS.map((f) => (
          <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.q}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
