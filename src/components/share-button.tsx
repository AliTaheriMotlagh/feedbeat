"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recordShare } from "@/server/actions";
import { XIcon } from "./platform-icon";

export function ShareButtons({ url, text, playlistId }: { url: string; text: string; playlistId?: string }) {
  const [copied, setCopied] = useState(false);

  async function reward() {
    if (!playlistId) return;
    const res = await recordShare(playlistId);
    if (res.ok && res.data.xp) toast.success(`+${res.data.xp} XP for sharing ✨`);
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url, text });
        await reward();
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
    await reward();
  }

  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" asChild>
        <a href={intent} target="_blank" rel="noopener noreferrer" onClick={() => void reward()}>
          <XIcon /> Share
        </a>
      </Button>
      <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
        {copied ? <Check /> : <Link2 />}
      </Button>
      <Button variant="outline" size="icon" onClick={nativeShare} aria-label="More sharing options" className="sm:hidden">
        <Share2 />
      </Button>
    </div>
  );
}
