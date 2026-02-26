import { describe, expect, it } from "vitest";
import { DEFAULT_FLASHCARD_SCHEDULER_SETTINGS } from "./flashcardScheduler";
import {
  getFlashcardRemainingNewQuota,
  hasFlashcardSchedulerSettings,
  markFlashcardReviewCompleted,
  markFlashcardNewSeenToday,
  readFlashcardDailyState,
  readFlashcardSchedulerProgress,
  readFlashcardSchedulerSettings,
  writeFlashcardSchedulerSettings,
} from "./flashcardSchedulerStore";

describe("flashcardSchedulerStore", () => {
  it("returns defaults when settings are missing", () => {
    localStorage.clear();
    expect(readFlashcardSchedulerSettings("pilot-a")).toEqual(
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS
    );
  });

  it("writes and reads user-scoped scheduler settings", () => {
    localStorage.clear();
    writeFlashcardSchedulerSettings("pilot-a", {
      dailyReviewTarget: 30,
      maxNewCardsPerDay: 5,
      lapseHandling: "aggressive",
      maxPerCategory: 4,
      weeklyReviewGoal: 60,
    });

    expect(readFlashcardSchedulerSettings("pilot-a")).toEqual({
      dailyReviewTarget: 30,
      maxNewCardsPerDay: 5,
      lapseHandling: "aggressive",
      maxPerCategory: 4,
      weeklyReviewGoal: 60,
    });
    expect(readFlashcardSchedulerSettings("pilot-b")).toEqual(
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS
    );
    expect(hasFlashcardSchedulerSettings("pilot-a")).toBe(true);
    expect(hasFlashcardSchedulerSettings("pilot-b")).toBe(false);
  });

  it("tracks daily new-card seen keys and dedupes duplicates", () => {
    localStorage.clear();
    const nowMs = Date.parse("2026-02-25T12:00:00.000Z");
    expect(markFlashcardNewSeenToday("pilot-a", "key-1", nowMs)).toBe(true);
    expect(markFlashcardNewSeenToday("pilot-a", "key-1", nowMs)).toBe(false);
    expect(markFlashcardNewSeenToday("pilot-a", "key-2", nowMs)).toBe(true);

    const state = readFlashcardDailyState("pilot-a", nowMs);
    expect(state.seenNewCanonicalKeys).toEqual(["key-1", "key-2"]);
    expect(getFlashcardRemainingNewQuota("pilot-a", 3, nowMs)).toBe(1);
  });

  it("resets daily quota state on day rollover", () => {
    localStorage.clear();
    const firstDay = Date.parse("2026-02-25T12:00:00.000Z");
    const nextDay = Date.parse("2026-02-26T12:00:00.000Z");
    expect(markFlashcardNewSeenToday("pilot-a", "key-1", firstDay)).toBe(true);
    expect(getFlashcardRemainingNewQuota("pilot-a", 1, firstDay)).toBe(0);
    expect(getFlashcardRemainingNewQuota("pilot-a", 1, nextDay)).toBe(1);
  });

  it("tracks weekly review progress and streak updates", () => {
    localStorage.clear();
    const day1 = Date.parse("2026-02-23T12:00:00.000Z");
    const day2 = Date.parse("2026-02-24T12:00:00.000Z");
    const day4 = Date.parse("2026-02-26T12:00:00.000Z");

    const afterDay1 = markFlashcardReviewCompleted("pilot-a", 3, day1);
    expect(afterDay1.completedThisWeek).toBe(3);
    expect(afterDay1.streakDays).toBe(1);

    const afterDay2 = markFlashcardReviewCompleted("pilot-a", 2, day2);
    expect(afterDay2.completedThisWeek).toBe(5);
    expect(afterDay2.streakDays).toBe(2);

    const afterDay4 = markFlashcardReviewCompleted("pilot-a", 1, day4);
    expect(afterDay4.completedThisWeek).toBe(6);
    expect(afterDay4.streakDays).toBe(1);

    const progress = readFlashcardSchedulerProgress("pilot-a", day4);
    expect(progress.completedThisWeek).toBe(6);
    expect(progress.streakDays).toBe(1);
  });
});
