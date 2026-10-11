import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The rules for using ${site.name}.`,
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <Prose>
      <h1>Terms of Service</h1>
      <p>Last updated: October 2026. This page is a starting template — have it reviewed before launch.</p>
      <h2>Using {site.name}</h2>
      <p>
        {site.name} organizes links that people have publicly shared. We don&apos;t host audio or video; playback happens through each
        platform&apos;s official player and remains subject to its terms.
      </p>
      <h2>Community rules</h2>
      <ul>
        <li>Be kind in comments. No harassment, hate speech, spam or personal information.</li>
        <li>Don&apos;t automate scans, likes or comments, or try to game XP. We may reset XP or suspend accounts that do.</li>
      </ul>
      <h2>Content</h2>
      <p>
        Trademarks and artwork belong to their respective owners. {site.name} is not affiliated with X Corp., Spotify, Google, Apple,
        SoundCloud, Deezer, TIDAL or Bandcamp.
      </p>
      <h2>No warranty</h2>
      <p>The service is provided “as is”. Playlists may be incomplete and links may stop working.</p>
    </Prose>
  );
}
