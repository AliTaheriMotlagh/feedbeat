import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { account, profiles, type Profile } from "@/db/schema";
import { features } from "@/env";
import { parseMusicUrl } from "@/lib/platforms";
import { mapLimit, resolveShortLink } from "./metadata";
import { HANDLE_RE } from "./scan";
import { recountProfile, rewardDiscovery, storeTracks, type FoundTrack } from "./tracks";

/**
 * Server half of the X-archive import. The browser parses the archive and
 * sends only music links, in chunks small enough for free-tier function limits.
 * Everything is re-validated here — the client is never trusted.
 */

export const CHUNK_SIZE = 100;

export const importRequest = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("start"),
    account: z.object({
      accountId: z.string().regex(/^\d{1,25}$/),
      username: z.string().regex(HANDLE_RE),
      displayName: z.string().max(100).nullable(),
    }),
    profile: z.object({
      bio: z.string().max(500).nullable(),
      avatarUrl: z
        .url()
        .regex(/^https:\/\/pbs\.twimg\.com\//)
        .nullable(),
    }),
    tweetsScanned: z.number().int().min(0).max(10_000_000),
  }),
  z.object({
    phase: z.literal("chunk"),
    profileId: z.uuid(),
    items: z
      .array(
        z.object({
          url: z.url().max(2048),
          tweetId: z.string().regex(/^\d{1,25}$/),
          tweetedAt: z.iso.datetime(),
          text: z.string().max(1000),
        }),
      )
      .min(1)
      .max(CHUNK_SIZE),
  }),
  z.object({ phase: z.literal("finish"), profileId: z.uuid() }),
]);

export type ImportRequest = z.infer<typeof importRequest>;

export class ImportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Does this user have "Sign in with X" linked to the given X account id? */
async function ownsXAccount(userId: string, xAccountId: string) {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "twitter"), eq(account.accountId, xAccountId)));
  return rows.length > 0;
}

async function canEdit(userId: string, p: Profile, xAccountId: string | null) {
  if (p.source === "archive" && p.discoveredById === userId) return true;
  const id = xAccountId ?? p.xUserId;
  return id ? ownsXAccount(userId, id) : false;
}

async function loadEditable(userId: string, profileId: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!p) throw new ImportError("Import not found.", 404);
  if (!(await canEdit(userId, p, null))) throw new ImportError("You can't update this profile.", 403);
  return p;
}

export async function startImport(userId: string, req: Extract<ImportRequest, { phase: "start" }>) {
  const { account: acc, profile: meta, tweetsScanned } = req;
  const handle = acc.username.toLowerCase();
  const verified = await ownsXAccount(userId, acc.accountId);

  // The same X account may already exist (possibly under an old handle).
  const [byId] = await db.select().from(profiles).where(eq(profiles.xUserId, acc.accountId));
  const [byHandle] = byId ? [byId] : await db.select().from(profiles).where(eq(profiles.handle, handle));
  const existing = byId ?? byHandle;

  const fields = {
    displayHandle: acc.username,
    name: acc.displayName,
    bio: meta.bio,
    avatarUrl: meta.avatarUrl?.replace("_normal", "_400x400") ?? null,
    xUserId: acc.accountId,
    tweetsScanned,
    lastScannedAt: new Date(),
  };

  if (!existing) {
    const [created] = await db
      .insert(profiles)
      .values({ ...fields, handle, source: "archive", ownerVerified: verified, status: "ready", discoveredById: userId })
      .onConflictDoNothing()
      .returning();
    if (!created) throw new ImportError("Someone just imported this profile. Please try again.", 409);
    return { profileId: created.id, handle: created.handle, isNew: true };
  }

  if (existing.hidden) throw new ImportError("This profile has opted out.", 403);
  if (existing.xUserId && existing.xUserId !== acc.accountId) {
    throw new ImportError(`This archive doesn't belong to the @${existing.displayHandle} already on the site.`, 409);
  }
  if (!(await canEdit(userId, existing, acc.accountId))) {
    throw new ImportError(
      features.xLogin
        ? `@${existing.displayHandle} is already on the site. If it's your account, sign in with X to update it.`
        : `@${existing.displayHandle} was already published by another curator.`,
      403,
    );
  }

  // Follow handle changes when the new handle is free.
  const [taken] = existing.handle === handle ? [] : await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.handle, handle));
  const nextHandle = existing.handle !== handle && !taken ? handle : existing.handle;

  await db
    .update(profiles)
    .set({ ...fields, handle: nextHandle, ownerVerified: existing.ownerVerified || verified, status: "ready", statusMessage: null })
    .where(eq(profiles.id, existing.id));
  return { profileId: existing.id, handle: nextHandle, isNew: false };
}

export async function importChunk(userId: string, req: Extract<ImportRequest, { phase: "chunk" }>) {
  const p = await loadEditable(userId, req.profileId);

  // Re-derive everything from the raw URL; ignore whatever the client parsed.
  const parsed = await mapLimit(req.items, 8, async (item) => {
    const ref = parseMusicUrl(await resolveShortLink(item.url));
    return ref ? ({ ref, tweetId: item.tweetId, tweetedAt: new Date(item.tweetedAt), text: item.text } satisfies FoundTrack) : null;
  });
  const found = parsed.filter((f): f is FoundTrack => f !== null);

  const added = await storeTracks(p.id, found);
  const total = await recountProfile(p.id);
  return { added, total };
}

export async function finishImport(userId: string, req: Extract<ImportRequest, { phase: "finish" }>) {
  const p = await loadEditable(userId, req.profileId);
  const total = await recountProfile(p.id);
  await db
    .update(profiles)
    .set({ lastScannedAt: new Date(), updatedAt: sql`now()` })
    .where(eq(profiles.id, p.id));
  if (p.discoveredById === userId && total > 0) await rewardDiscovery(p.id, userId, total);
  return { handle: p.handle, total };
}
