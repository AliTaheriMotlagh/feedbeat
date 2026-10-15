import type { Metadata } from "next";
import { ExtensionImport } from "@/components/extension-import";

export const metadata: Metadata = {
  title: "Import your songs from the Feedbeat extension",
  description: "Finish an import started by the Feedbeat Collector browser extension.",
  robots: { index: false, follow: false },
};

export default function ExtensionImportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold text-primary">Free · Private · No zip needed</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
        Your songs, <span className="text-gradient">ready to publish</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        The Feedbeat Collector extension gathers the music links from your own posts in your browser. Review them here, then publish.
      </p>
      <ExtensionImport />
    </div>
  );
}
