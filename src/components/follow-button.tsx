"use client";

import { Check, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/server/actions";
import { useAuthPrompt } from "./auth-prompt";

export function FollowButton({ profileId, following, handle }: { profileId: string; following: boolean; handle: string }) {
  const [state, setState] = useState(following);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, startTransition] = useTransition();
  const prompt = useAuthPrompt();

  return (
    <Button
      variant={optimistic ? "secondary" : "default"}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const res = await toggleFollow(profileId);
          if (!res.ok) {
            if (res.code === "auth") prompt(`Sign in to follow @${handle} and get their new finds in your feed.`);
            else toast.error(res.error);
            return;
          }
          setState(res.data.following);
          if (res.data.following) toast.success(`Following @${handle}`);
        })
      }
    >
      {optimistic ? <Check /> : <Plus />}
      {optimistic ? "Following" : "Follow"}
    </Button>
  );
}
