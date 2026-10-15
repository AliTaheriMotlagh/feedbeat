import type { Metadata } from "next";
import { ExtensionImport } from "@/components/extension-import";

export const metadata: Metadata = {
  title: "Scan your X posts for music with the Feedbeat extension",
  description: "Scan every post you've ever written for music links with the Feedbeat Collector browser extension, then publish them as playlists.",
  robots: { index: false, follow: false },
};

export default function ExtensionImportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold text-primary">Free · Private · No archive needed</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
        Every song you posted, <span className="text-gradient">straight from X</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        The Feedbeat Collector extension reads your own posts in your browser, all the way back to your first one, and picks out the music. Run it from
        this page, pause whenever you like, and publish when you&apos;re ready.
      </p>
      <ExtensionImport />
    </div>
  );
}
