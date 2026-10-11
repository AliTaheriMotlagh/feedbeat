import { ChevronDown } from "lucide-react";
import { site } from "@/lib/site";

export const FAQ_ITEMS = [
  {
    q: `How does ${site.name} find music in a timeline?`,
    a: `Download your free X archive and drop it on the Import page. It's read entirely in your browser: we look for links to Spotify, YouTube, YouTube Music, Apple Music, SoundCloud, Deezer, TIDAL and Bandcamp — including shortened links and reposts — and only those links are uploaded. Each link becomes a track in that platform's playlist.`,
  },
  {
    q: "Is it free?",
    a: `Yes, completely. Browsing, playing, importing and sharing are free. Sign in (GitHub or Google) to publish, like, follow, comment, earn XP and save playlists to Spotify.`,
  },
  {
    q: "Can I save a playlist to my own Spotify account?",
    a: `Yes — connect Spotify once and press “Save to Spotify” on any Spotify playlist. For YouTube you can open the whole playlist as a queue with one click, no account needed.`,
  },
  {
    q: "Is my archive uploaded?",
    a: `No. The archive is opened locally in your browser. We never see your DMs, e-mail, likes or anything else — only the music links you choose to publish. Anyone can ask us to remove their profile from ${site.name}.`,
  },
  {
    q: "How often are playlists updated?",
    a: `Import a newer archive any time — only new songs are added. (Deployments with X API access can also refresh profiles automatically.)`,
  },
  {
    q: "How do XP and levels work?",
    a: `You earn XP for publishing profiles (+50, plus a bonus per song found), for likes your playlists receive, for commenting, sharing and daily visits. XP unlocks levels from Listener to Legend, and milestones unlock badges.`,
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
