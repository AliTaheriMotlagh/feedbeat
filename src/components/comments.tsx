"use client";

import { Loader2, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { addComment, deleteComment, type CommentDto } from "@/server/actions";
import { useAuthPrompt } from "./auth-prompt";
import { Avatar } from "./avatar";
import { LevelPill } from "./level-pill";
import { TimeAgo } from "./time-ago";

export function Comments({ playlistId, initial }: { playlistId: string; initial: CommentDto[] }) {
  const [items, setItems] = useState(initial);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const { data: session } = useSession();
  const prompt = useAuthPrompt();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return prompt("Sign in to join the conversation.");
    startTransition(async () => {
      const res = await addComment({ playlistId, body });
      if (!res.ok) {
        if (res.code === "auth") prompt();
        else toast.error(res.error);
        return;
      }
      setItems((prev) => [res.data, ...prev]);
      setBody("");
    });
  }

  function remove(id: string) {
    const prev = items;
    setItems((xs) => xs.filter((c) => c.id !== id));
    startTransition(async () => {
      const res = await deleteComment(id);
      if (!res.ok) {
        setItems(prev);
        toast.error(res.error);
      }
    });
  }

  return (
    <section aria-labelledby="comments-title" className="space-y-4">
      <h2 id="comments-title" className="font-display text-xl font-bold">
        Comments <span className="text-muted-foreground">{items.length || ""}</span>
      </h2>

      <form onSubmit={submit} className="flex items-start gap-3">
        <Avatar src={session?.user.image} name={session?.user.name ?? "?"} className="size-9" />
        <div className="flex-1">
          <label htmlFor="comment" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => !session && prompt("Sign in to join the conversation.")}
            placeholder="What's your favorite track here?"
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">{body.length}/500</span>
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />} Post
            </Button>
          </div>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No comments yet. Be the first — it&apos;s worth +5 XP.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar src={c.author.image} name={c.author.name} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {c.author.username ? (
                    <Link href={`/c/${c.author.username}`} className="font-semibold hover:underline">
                      {c.author.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{c.author.name}</span>
                  )}
                  <LevelPill xp={c.author.xp} />
                  <TimeAgo date={c.createdAt} className="text-xs text-muted-foreground" />
                  {session?.user.id === c.author.id && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-line">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
