import type { Metadata } from "next";
import type { AboutPage } from "schema-dts";
import { JsonLd } from "@/components/json-ld";
import { Prose } from "@/components/prose";
import { absoluteUrl, site } from "@/lib/site";
import { FAQ } from "../faq";

export const metadata: Metadata = {
  title: "About & FAQ",
  description: `What ${site.name} is, how it turns X timelines into playlists, and how XP, levels and badges work.`,
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <>
      <Prose>
        <h1>About {site.name}</h1>
        <p>
          People share incredible music on X every day — and it disappears down the timeline. {site.name} rescues it. Enter any public
          username and we build a playlist per platform from every song, album and video they&apos;ve linked.
        </p>
        <h2>Built for diggers</h2>
        <p>
          Playlists are public, so anyone can play, like and comment on them. Discover a profile first and it&apos;s credited to you. Earn
          XP, keep your streak alive and collect badges on your way from Listener to Legend.
        </p>
        <h2>Supported platforms</h2>
        <p>Spotify, YouTube & YouTube Music, Apple Music, SoundCloud, Deezer, TIDAL and Bandcamp — including short links and reposts.</p>
      </Prose>
      <FAQ />
      <JsonLd<AboutPage>
        data={{ "@context": "https://schema.org", "@type": "AboutPage", name: `About ${site.name}`, url: absoluteUrl("/about") }}
      />
    </>
  );
}
