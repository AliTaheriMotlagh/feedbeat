import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} handles data.`,
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <Prose>
      <h1>Privacy Policy</h1>
      <p>Last updated: October 2026. This page is a starting template — have it reviewed for your jurisdiction before launch.</p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>X archive imports</strong>: your archive is opened in your browser and never uploaded. We only receive what you publish:
          your X username, display name, account id, bio, avatar URL and the music links found in your posts (with post id, date and text).
          We never read your e-mail, phone number, DMs, likes or IP history from the archive.
        </li>
        <li>
          <strong>Public X data</strong>: on deployments with X API access, for scanned profiles we store the same public fields fetched
          from X.
        </li>
        <li>
          <strong>Your account</strong>: when you sign in (GitHub, Google or X) we store your name, username, avatar and e-mail, plus your
          likes, follows, comments, XP and badges.
        </li>
        <li>
          <strong>Connected Spotify</strong>: if you connect Spotify we store OAuth tokens solely to create playlists you ask us to save.
        </li>
        <li>
          <strong>Analytics</strong>: privacy-friendly, cookieless page analytics and performance metrics (Vercel Web Analytics).
        </li>
      </ul>
      <h2>What we never do</h2>
      <ul>
        <li>Post, like or follow on X on your behalf.</li>
        <li>Read private or protected posts or direct messages.</li>
        <li>Sell your personal data.</li>
      </ul>
      <h2>Removal requests</h2>
      <p>
        If you own a scanned X account and want it removed from {site.name}, contact us from that account and we&apos;ll hide the profile and
        delete its playlists. You can delete your own {site.name} account at any time.
      </p>
      <h2>Embedded players</h2>
      <p>
        Players from Spotify, YouTube (privacy-enhanced mode), Apple Music, SoundCloud, Deezer and TIDAL load only after you press play and
        are subject to those services&apos; privacy policies.
      </p>
    </Prose>
  );
}
