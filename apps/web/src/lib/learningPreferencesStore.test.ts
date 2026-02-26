import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LEARNING_PREFERENCES,
  readLearningPreferences,
  readWeeklyGoalProgress,
  writeLearningPreferences,
} from "./learningPreferencesStore";

describe("learningPreferencesStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads default preferences when missing", () => {
    expect(readLearningPreferences("pilot-a")).toEqual(DEFAULT_LEARNING_PREFERENCES);
  });

  it("writes and reads user-scoped preferences", () => {
    writeLearningPreferences("pilot-a", {
      defaultStudyCategory: "Airspace",
      defaultExamCategory: "Operations",
      defaultLearnBatchSize: 10,
      defaultFlashcardDailyReviewTarget: 30,
      weeklyStudyGoalSessions: 7,
      weeklyExamGoalSessions: 3,
    });

    expect(readLearningPreferences("pilot-a")).toEqual({
      defaultStudyCategory: "Airspace",
      defaultExamCategory: "Operations",
      defaultLearnBatchSize: 10,
      defaultFlashcardDailyReviewTarget: 30,
      weeklyStudyGoalSessions: 7,
      weeklyExamGoalSessions: 3,
    });
    expect(readLearningPreferences("pilot-b")).toEqual(DEFAULT_LEARNING_PREFERENCES);
  });

  it("normalizes invalid category and goal values", () => {
    localStorage.setItem(
      "part107_learning_preferences_v1:pilot-a",
      JSON.stringify({
        defaultStudyCategory: "Unknown",
        defaultExamCategory: "Other",
        defaultLearnBatchSize: 999,
        defaultFlashcardDailyReviewTarget: 999,
        weeklyStudyGoalSessions: 500,
        weeklyExamGoalSessions: -2,
      })
    );
    expect(readLearningPreferences("pilot-a")).toEqual({
      defaultStudyCategory: "All",
      defaultExamCategory: "All",
      defaultLearnBatchSize: 20,
      defaultFlashcardDailyReviewTarget: 200,
      weeklyStudyGoalSessions: 30,
      weeklyExamGoalSessions: 0,
    });
  });

  it("computes weekly study/exam goal progress from recent sessions", () => {
    localStorage.setItem(
      "part107_progress:pilot-a",
      JSON.stringify([
        { id: "s1", mode: "study", timestamp: "2026-02-25T12:00:00.000Z" },
        { id: "s2", mode: "learn", timestamp: "2026-02-24T12:00:00.000Z" },
        { id: "s3", mode: "flashcards", timestamp: "2026-02-23T12:00:00.000Z" },
        { id: "s4", mode: "exam", timestamp: "2026-02-22T12:00:00.000Z" },
        { id: "s5", mode: "exam", timestamp: "2026-01-01T12:00:00.000Z" },
      ])
    );

    const progress = readWeeklyGoalProgress(
      "pilot-a",
      Date.parse("2026-02-25T12:00:00.000Z"),
      7
    );
    expect(progress).toEqual({
      studySessions: 3,
      examSessions: 1,
      windowDays: 7,
    });
  });
});
