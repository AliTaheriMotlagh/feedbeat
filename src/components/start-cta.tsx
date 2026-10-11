import { ArrowRight, FileArchive, Lock } from "lucide-react";
import Link from "next/link";
import { features } from "@/env";
import { cn } from "@/lib/utils";
import { ScanForm } from "./scan-form";
import { Button } from "./ui/button";

/**
 * The primary "get started" action. With an X API key we can scan any handle;
 * without one (the free setup) visitors import their own X archive instead.
 */
export function StartCta({ size = "lg", defaultHandle, className }: { size?: "lg" | "sm"; defaultHandle?: string; className?: string }) {
  if (features.scanning) {
    return (
      <div className={cn("w-full", className)}>
        <ScanForm size={size} defaultHandle={defaultHandle} />
        <p className="mt-2 px-4 text-sm text-muted-foreground">
          Want your <em>entire</em> history?{" "}
          <Link href="/import" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            Import your X archive
          </Link>{" "}
          — free & private.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size={size === "lg" ? "lg" : "default"} variant="gradient" asChild>
          <Link href="/import">
            <FileArchive /> {defaultHandle ? `Is this you? Import your archive` : "Turn my X archive into playlists"}
          </Link>
        </Button>
        <Button size={size === "lg" ? "lg" : "default"} variant="outline" asChild>
          <Link href="/explore">
            Explore playlists <ArrowRight />
          </Link>
        </Button>
      </div>
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="size-3.5" /> Free · read in your browser · only music links are uploaded
      </p>
    </div>
  );
}
