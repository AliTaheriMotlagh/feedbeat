import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import type { HowTo } from "schema-dts";
import { ArchiveImporter } from "@/components/archive-importer";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Turn your X archive into Spotify & YouTube playlists — free",
  description: `Drop (or link) your free X (Twitter) data archive and ${site.name} finds every song you've ever posted, right in your browser. Publish playlists for Spotify, YouTube, Apple Music and more.`,
  alternates: { canonical: "/import" },
};

const STEPS = [
  {
    title: "Request your archive on X",
    body: "Settings → Your account → Download an archive of your data. X e-mails you when it's ready (usually within a day). It's free.",
  },
  {
    title: "Drop the .zip or paste a link",
    body: "We open it in your browser and pick out only your posts. Hosted it on Dropbox or Google Drive? Paste the link instead.",
  },
  { title: "Publish", body: "Review the songs we found, then publish. Only the music links go to our server." },
];

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold text-primary">Free · Private · No API needed</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
        Your whole X history, <span className="text-gradient">as playlists</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Every song, album and video you&apos;ve shared since you joined — not just the latest posts. Your archive is read on your own device.
      </p>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-border bg-card p-4">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
            <p className="mt-3 font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <a
        href="https://x.com/settings/download_your_data"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Request my archive on X <ExternalLink className="size-3.5" />
      </a>

      <div className="mt-10">
        <ArchiveImporter />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Don&apos;t want to unzip anything? Use the{" "}
        <a href="/import/extension" className="font-medium text-primary hover:underline">
          Feedbeat Collector extension
        </a>{" "}
        on your own X profile instead.
      </p>

      <JsonLd<HowTo>
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Turn your X archive into playlists",
          url: absoluteUrl("/import"),
          step: STEPS.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body })),
        }}
      />
    </div>
  );
}
