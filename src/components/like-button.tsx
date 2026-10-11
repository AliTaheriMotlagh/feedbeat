"use client";

import { Heart } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleLike } from "@/server/actions";
import { cn, formatCompact } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";

export function LikeButton({ playlistId, liked, count, size = "default" }: { playlistId: string; liked: boolean; count: number; size?: "default" | "sm" }) {
  const [state, setState] = useState({ liked, count });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, startTransition] = useTransition();
  const prompt = useAuthPrompt();

  function onClick() {
    startTransition(async () => {
      setOptimistic({ liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) });
      const res = await toggleLike(playlistId);
      if (!res.ok) {
        if (res.code === "auth") prompt("Sign in to like playlists and earn XP.");
        else toast.error(res.error);
        return;
      }
      setState({ liked: res.data.liked, count: res.data.likeCount });
    });
  }

  return (
    <Button
      variant={optimistic.liked ? "secondary" : "outline"}
      size={size}
      onClick={onClick}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "Unlike playlist" : "Like playlist"}
    >
      <Heart className={cn("transition-transform", optimistic.liked && "scale-110 fill-rose-500 text-rose-500")} />
      <span className="tabular-nums">{formatCompact(optimistic.count)}</span>
    </Button>
  );
}
