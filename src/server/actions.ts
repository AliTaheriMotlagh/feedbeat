"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activities, comments, playlistLikes, playlists, profileFollows, profiles } from "@/db/schema";
import { XP } from "@/lib/gamification";
import { getSession } from "@/lib/auth";
import { rateLimit } from "./rate-limit";
import { ExportError, exportPlaylistToSpotify } from "./spotify-export";
import { awardXp, syncBadges, touchStreak } from "./xp";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: "auth" | "rate" | "invalid" | "spotify" };

const uuid = z.uuid();

async function requireUser() {
  const session = await getSession();
  return session?.user ?? null;
}

const AUTH_ERROR = { ok: false, error: "Sign in to do that.", code: "auth" } as const;
const RATE_ERROR = { ok: false, error: "Slow down a little — try again in a minute.", code: "rate" } as const;

/* ---------------------------------- Likes ---------------------------------- */

export async function toggleLike(playlistId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  if (!uuid.safeParse(playlistId).success) return { ok: false, error: "Invalid playlist", code: "invalid" };
  const me = await requireUser();
  if (!me) return AUTH_ERROR;
  if (!(await rateLimit("like", me.id, 60, "1 m")).success) return RATE_ERROR;

  const removed = await db
    .delete(playlistLikes)
    .where(and(eq(playlistLikes.userId, me.id), eq(playlistLikes.playlistId, playlistId)))
    .returning();

  let liked: boolean;
  if (removed.length) {
    liked = false;
  } else {
    const inserted = await db.insert(playlistLikes).values({ userId: me.id, playlistId }).onConflictDoNothing().returning();
    liked = inserted.length > 0;
  }

  const [pl] = await db
    .update(playlists)
    .set({ likeCount: sql`(select count(*) from ${playlistLikes} where ${playlistLikes.playlistId} = ${playlistId})` })
    .where(eq(playlists.id, playlistId))
    .returning({ likeCount: playlists.likeCount, profileId: playlists.profileId });
  if (!pl) return { ok: false, error: "Playlist not found", code: "invalid" };

  if (liked) {
    // XP is keyed by playlist so like/unlike spam can't farm points.
    await awardXp(me.id, "like", XP.like, playlistId);
    const [owner] = await db.select({ id: profiles.discoveredById }).from(profiles).where(eq(profiles.id, pl.profileId));
    if (owner?.id && owner.id !== me.id) {
      await awardXp(owner.id, "like-received", XP.likeReceived, `${playlistId}:${me.id}`);
      await syncBadges(owner.id);
    }
    await db.insert(activities).values({ type: "like", actorId: me.id, profileId: pl.profileId, playlistId });
    await syncBadges(me.id);
  }
  await touchStreak(me.id);

  return { ok: true, data: { liked, likeCount: pl.likeCount } };
}

/* --------------------------------- Follows --------------------------------- */

export async function toggleFollow(profileId: string): Promise<ActionResult<{ following: boolean; followerCount: number }>> {
  if (!uuid.safeParse(profileId).success) return { ok: false, error: "Invalid profile", code: "invalid" };
  const me = await requireUser();
  if (!me) return AUTH_ERROR;
  if (!(await rateLimit("follow", me.id, 60, "1 m")).success) return RATE_ERROR;

  const removed = await db
    .delete(profileFollows)
    .where(and(eq(profileFollows.userId, me.id), eq(profileFollows.profileId, profileId)))
    .returning();
  const following = removed.length === 0;
  if (following) {
    await db.insert(profileFollows).values({ userId: me.id, profileId }).onConflictDoNothing();
    await awardXp(me.id, "follow", XP.follow, profileId);
    await db.insert(activities).values({ type: "follow", actorId: me.id, profileId });
  }

  const [p] = await db
    .update(profiles)
    .set({ followerCount: sql`(select count(*) from ${profileFollows} where ${profileFollows.profileId} = ${profileId})` })
    .where(eq(profiles.id, profileId))
    .returning({ followerCount: profiles.followerCount });

  await touchStreak(me.id);
  return { ok: true, data: { following, followerCount: p?.followerCount ?? 0 } };
}

/* --------------------------------- Comments -------------------------------- */

const commentSchema = z.object({
  playlistId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Say something!")
    .max(500, "Keep it under 500 characters"),
});

export interface CommentDto {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; username: string | null; image: string | null; xp: number };
}

export async function addComment(input: { playlistId: string; body: string }): Promise<ActionResult<CommentDto>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment", code: "invalid" };
  const me = await requireUser();
  if (!me) return AUTH_ERROR;
  if (!(await rateLimit("comment", me.id, 5, "1 m")).success) return RATE_ERROR;

  const [c] = await db
    .insert(comments)
    .values({ playlistId: parsed.data.playlistId, userId: me.id, body: parsed.data.body })
    .returning();
  const [pl] = await db
    .update(playlists)
    .set({ commentCount: sql`${playlists.commentCount} + 1` })
    .where(eq(playlists.id, parsed.data.playlistId))
    .returning({ profileId: playlists.profileId });

  // Only the first comment per playlist earns XP.
  await awardXp(me.id, "comment", XP.comment, parsed.data.playlistId);
  await db.insert(activities).values({ type: "comment", actorId: me.id, playlistId: parsed.data.playlistId, profileId: pl?.profileId });
  await syncBadges(me.id);
  await touchStreak(me.id);

  return {
    ok: true,
    data: {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: { id: me.id, name: me.name, username: (me.username as string | null) ?? null, image: me.image ?? null, xp: (me.xp as number) ?? 0 },
    },
  };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  if (!uuid.safeParse(commentId).success) return { ok: false, error: "Invalid comment", code: "invalid" };
  const me = await requireUser();
  if (!me) return AUTH_ERROR;
  const [c] = await db
    .delete(comments)
    .where(and(eq(comments.id, commentId), eq(comments.userId, me.id)))
    .returning({ playlistId: comments.playlistId });
  if (c) {
    await db
      .update(playlists)
      .set({ commentCount: sql`greatest(${playlists.commentCount} - 1, 0)` })
      .where(eq(playlists.id, c.playlistId));
  }
  return { ok: true, data: undefined };
}

/* ------------------------------ Plays & shares ----------------------------- */

export async function recordPlay(playlistId: string): Promise<void> {
  if (!uuid.safeParse(playlistId).success) return;
  await db
    .update(playlists)
    .set({ playCount: sql`${playlists.playCount} + 1` })
    .where(eq(playlists.id, playlistId));
}

export async function recordShare(playlistId: string): Promise<ActionResult<{ xp: number }>> {
  if (!uuid.safeParse(playlistId).success) return { ok: false, error: "Invalid playlist", code: "invalid" };
  const me = await requireUser();
  if (!me) return { ok: true, data: { xp: 0 } };
  const fresh = await awardXp(me.id, "share", XP.share, playlistId);
  return { ok: true, data: { xp: fresh ? XP.share : 0 } };
}

/* --------------------------------- Export ---------------------------------- */

export async function exportToSpotify(playlistId: string): Promise<ActionResult<{ url: string }>> {
  if (!uuid.safeParse(playlistId).success) return { ok: false, error: "Invalid playlist", code: "invalid" };
  const me = await requireUser();
  if (!me) return AUTH_ERROR;
  if (!(await rateLimit("export", me.id, 5, "1 h")).success) return RATE_ERROR;
  try {
    const url = await exportPlaylistToSpotify(me.id, playlistId);
    return { ok: true, data: { url } };
  } catch (err) {
    if (err instanceof ExportError) {
      return { ok: false, error: err.message, ...(err.code === "not_linked" ? { code: "spotify" as const } : {}) };
    }
    console.error("[export] spotify", err);
    return { ok: false, error: "Export failed. Please try again." };
  }
}

/* --------------------------------- Streaks --------------------------------- */

/** Called once per page load for signed-in users (cheap no-op after the first call each day). */
export async function pingActivity(): Promise<void> {
  const me = await requireUser();
  if (me) await touchStreak(me.id);
}
