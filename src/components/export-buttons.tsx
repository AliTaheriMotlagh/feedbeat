"use client";

import { ListMusic, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { exportToSpotify } from "@/server/actions";
import { useAuthPrompt } from "./auth-prompt";
import { PlatformIcon } from "./platform-icon";

/** "Save to Spotify" — copies the playlist into the viewer's own Spotify account. */
export function SpotifyExportButton({ playlistId }: { playlistId: string }) {
  const [pending, startTransition] = useTransition();
  const prompt = useAuthPrompt();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await exportToSpotify(playlistId);
          if (res.ok) {
            toast.success("Saved to your Spotify library", {
              action: { label: "Open", onClick: () => window.open(res.data.url, "_blank", "noopener") },
            });
            return;
          }
          if (res.code === "auth") return prompt("Sign in to save playlists to Spotify.");
          if (res.code === "spotify") {
            toast("Connect Spotify to save playlists", {
              action: {
                label: "Connect",
                onClick: () => void authClient.linkSocial({ provider: "spotify", callbackURL: window.location.pathname }),
              },
            });
            return;
          }
          toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <PlatformIcon platform="spotify" colored />}
      Save to Spotify
    </Button>
  );
}

/** YouTube can build an anonymous queue from up to 50 video ids — no sign-in needed. */
export function YouTubeQueueButton({ videoIds }: { videoIds: string[] }) {
  if (!videoIds.length) return null;
  const href = `https://www.youtube.com/watch_videos?video_ids=${videoIds.slice(0, 50).join(",")}`;
  return (
    <Button variant="outline" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ListMusic /> Play all on YouTube
      </a>
    </Button>
  );
}
