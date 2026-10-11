import { describe, expect, it } from "vitest";
import { levelFromXp, nextStreak, qualifyingBadges, xpForLevel } from "./gamification";

describe("levels", () => {
  it("starts at level 1", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, floor: 0, next: 100, progress: 0 });
  });

  it("is consistent with xpForLevel at every boundary", () => {
    for (let n = 1; n < 40; n++) {
      expect(levelFromXp(xpForLevel(n)).level).toBe(n);
      expect(levelFromXp(xpForLevel(n + 1) - 1).level).toBe(n);
    }
  });

  it("reports progress within a level", () => {
    expect(levelFromXp(50).progress).toBeCloseTo(0.5);
  });
});

describe("streaks", () => {
  it("continues from yesterday", () => {
    expect(nextStreak("2026-01-01", 3, "2026-01-02")).toEqual({ streak: 4, isNewDay: true });
  });
  it("resets after a gap", () => {
    expect(nextStreak("2025-12-30", 3, "2026-01-02")).toEqual({ streak: 1, isNewDay: true });
  });
  it("is idempotent within a day", () => {
    expect(nextStreak("2026-01-02", 3, "2026-01-02")).toEqual({ streak: 3, isNewDay: false });
  });
  it("crosses month boundaries", () => {
    expect(nextStreak("2026-02-28", 1, "2026-03-01").streak).toBe(2);
  });
});

describe("badges", () => {
  it("awards by thresholds", () => {
    const base = { discoveries: 0, biggestDiscovery: 0, likesReceived: 0, comments: 0, likesGiven: 0, streak: 0 };
    expect(qualifyingBadges(base)).toEqual([]);
    expect(qualifyingBadges({ ...base, discoveries: 10, streak: 7 })).toEqual(["pioneer", "explorer", "on-fire"]);
  });
});
