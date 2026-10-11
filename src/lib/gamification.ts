/**
 * Pure gamification rules: XP values, levels and badge definitions.
 * Side-effects (writing to the DB) live in `src/server/xp.ts`.
 */

export const XP = {
  discover: 50, // first person to scan a handle
  discoverPerTrack: 1, // bonus per track found on a discovery (capped)
  discoverTrackCap: 100,
  refresh: 5,
  like: 2, // giving a like
  likeReceived: 5, // a playlist you discovered gets liked
  comment: 5,
  follow: 1,
  dailyVisit: 10,
  share: 10,
} as const;

export interface Level {
  level: number;
  title: string;
  /** XP needed to reach this level. */
  floor: number;
  /** XP needed to reach the next level (null at max). */
  next: number | null;
  /** 0..1 progress within the level. */
  progress: number;
}

const TITLES = ["Listener", "Crate Digger", "Selector", "Curator", "Tastemaker", "Trendsetter", "Legend"];

/** XP floor for level n (1-based): 0, 100, 300, 600, 1000, 1500, ... */
export function xpForLevel(n: number): number {
  return 50 * (n - 1) * n;
}

export function levelFromXp(xp: number): Level {
  const safe = Math.max(0, Math.floor(xp));
  // Solve 50*(n-1)*n <= xp for n.
  let level = Math.floor((1 + Math.sqrt(1 + (4 * safe) / 50)) / 2);
  level = Math.max(1, level);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))],
    floor,
    next,
    progress: (safe - floor) / (next - floor),
  };
}

export type BadgeId =
  | "pioneer"
  | "explorer"
  | "cartographer"
  | "goldmine"
  | "tastemaker"
  | "critic"
  | "collector"
  | "on-fire"
  | "devoted"
  | "early-adopter";

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  emoji: string;
  tier: "bronze" | "silver" | "gold";
}

export const BADGES: Record<BadgeId, Badge> = {
  pioneer: { id: "pioneer", name: "Pioneer", description: "Discovered your first profile", emoji: "🧭", tier: "bronze" },
  explorer: { id: "explorer", name: "Explorer", description: "Discovered 10 profiles", emoji: "🗺️", tier: "silver" },
  cartographer: { id: "cartographer", name: "Cartographer", description: "Discovered 50 profiles", emoji: "🌍", tier: "gold" },
  goldmine: { id: "goldmine", name: "Goldmine", description: "Discovered a profile with 100+ tracks", emoji: "💎", tier: "gold" },
  tastemaker: { id: "tastemaker", name: "Tastemaker", description: "Your discoveries earned 25 likes", emoji: "✨", tier: "silver" },
  critic: { id: "critic", name: "Critic", description: "Left 10 comments", emoji: "🖋️", tier: "bronze" },
  collector: { id: "collector", name: "Collector", description: "Liked 25 playlists", emoji: "💿", tier: "bronze" },
  "on-fire": { id: "on-fire", name: "On Fire", description: "7-day streak", emoji: "🔥", tier: "silver" },
  devoted: { id: "devoted", name: "Devoted", description: "30-day streak", emoji: "🏆", tier: "gold" },
  "early-adopter": { id: "early-adopter", name: "Early Adopter", description: "Joined during launch season", emoji: "🚀", tier: "bronze" },
};

export interface BadgeStats {
  discoveries: number;
  biggestDiscovery: number;
  likesReceived: number;
  comments: number;
  likesGiven: number;
  streak: number;
}

/** Which badges a user qualifies for, given their stats. */
export function qualifyingBadges(s: BadgeStats): BadgeId[] {
  const out: BadgeId[] = [];
  if (s.discoveries >= 1) out.push("pioneer");
  if (s.discoveries >= 10) out.push("explorer");
  if (s.discoveries >= 50) out.push("cartographer");
  if (s.biggestDiscovery >= 100) out.push("goldmine");
  if (s.likesReceived >= 25) out.push("tastemaker");
  if (s.comments >= 10) out.push("critic");
  if (s.likesGiven >= 25) out.push("collector");
  if (s.streak >= 7) out.push("on-fire");
  if (s.streak >= 30) out.push("devoted");
  return out;
}

/** Next streak value given the last active day (YYYY-MM-DD, UTC). */
export function nextStreak(lastActiveOn: string | null, current: number, today: string): { streak: number; isNewDay: boolean } {
  if (lastActiveOn === today) return { streak: current, isNewDay: false };
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const continues = lastActiveOn === yesterday.toISOString().slice(0, 10);
  return { streak: continues ? current + 1 : 1, isNewDay: true };
}
