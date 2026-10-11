import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { PLATFORM_IDS } from "@/lib/platforms";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/*                         Auth (Better Auth core tables)                     */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // App fields (declared as Better Auth `additionalFields` too)
  username: text("username").unique(),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastActiveOn: text("last_active_on"), // YYYY-MM-DD (UTC) for streaks
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                                   Domain                                   */
/* -------------------------------------------------------------------------- */

export const platformEnum = pgEnum("platform", PLATFORM_IDS);
export const scanStatusEnum = pgEnum("scan_status", ["queued", "scanning", "ready", "error"]);

/** An X account whose timeline has been turned into playlists. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lower-cased handle, without "@". */
    handle: text("handle").notNull(),
    displayHandle: text("display_handle").notNull(),
    xUserId: text("x_user_id").unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    followersCount: integer("followers_count").notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    status: scanStatusEnum("status").notNull().default("queued"),
    statusMessage: text("status_message"),
    newestTweetId: text("newest_tweet_id"),
    tweetsScanned: integer("tweets_scanned").notNull().default(0),
    trackCount: integer("track_count").notNull().default(0),
    followerCount: integer("follower_count").notNull().default(0), // followers on Feedbeat
    views: integer("views").notNull().default(0),
    hidden: boolean("hidden").notNull().default(false), // opt-out / moderation
    discoveredById: text("discovered_by_id").references(() => user.id, { onDelete: "set null" }),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    scanStartedAt: timestamp("scan_started_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_handle_idx").on(t.handle),
    index("profiles_track_count_idx").on(t.trackCount),
    index("profiles_created_idx").on(t.createdAt),
  ],
);

/** One playlist per (profile, platform). */
export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    trackCount: integer("track_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    playCount: integer("play_count").notNull().default(0),
    coverUrl: text("cover_url"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("playlists_profile_platform_idx").on(t.profileId, t.platform),
    index("playlists_like_count_idx").on(t.likeCount),
  ],
);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    kind: text("kind").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    artist: text("artist"),
    thumbnailUrl: text("thumbnail_url"),
    tweetId: text("tweet_id").notNull(),
    tweetText: text("tweet_text"),
    tweetedAt: timestamp("tweeted_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("tracks_unique_idx").on(t.profileId, t.platform, t.externalId),
    index("tracks_playlist_idx").on(t.playlistId, t.tweetedAt),
  ],
);

/* ------------------------------- Social graph ------------------------------ */

export const playlistLikes = pgTable(
  "playlist_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.playlistId] }), index("likes_playlist_idx").on(t.playlistId, t.createdAt)],
);

export const profileFollows = pgTable(
  "profile_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.profileId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("comments_playlist_idx").on(t.playlistId, t.createdAt)],
);

/* -------------------------------- Gamification ----------------------------- */

/** Append-only XP ledger. (userId, reason, refId) is unique → awards are idempotent. */
export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    refId: text("ref_id").notNull().default(""),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("xp_events_idem_idx").on(t.userId, t.reason, t.refId),
    index("xp_events_created_idx").on(t.createdAt),
  ],
);

export const userBadges = pgTable(
  "user_badges",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    badge: text("badge").notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badge] })],
);

export const activityTypeEnum = pgEnum("activity_type", ["discover", "like", "comment", "follow", "badge"]);

/** Public activity feed. */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: activityTypeEnum("type").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
    playlistId: uuid("playlist_id").references(() => playlists.id, { onDelete: "cascade" }),
    meta: text("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activities_created_idx").on(sql`${t.createdAt} desc`)],
);

/* -------------------------------- Relations -------------------------------- */

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  playlists: many(playlists),
  tracks: many(tracks),
  discoveredBy: one(user, { fields: [profiles.discoveredById], references: [user.id] }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  profile: one(profiles, { fields: [playlists.profileId], references: [profiles.id] }),
  tracks: many(tracks),
  comments: many(comments),
}));

export const tracksRelations = relations(tracks, ({ one }) => ({
  playlist: one(playlists, { fields: [tracks.playlistId], references: [playlists.id] }),
  profile: one(profiles, { fields: [tracks.profileId], references: [profiles.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  playlist: one(playlists, { fields: [comments.playlistId], references: [playlists.id] }),
  author: one(user, { fields: [comments.userId], references: [user.id] }),
}));

export type Profile = typeof profiles.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type User = typeof user.$inferSelect;
