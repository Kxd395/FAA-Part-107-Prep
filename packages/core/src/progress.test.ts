import { describe, expect, it } from "vitest";
import { computeProgressStats, type ProgressSessionRecord } from "./progress";

const sessions: ProgressSessionRecord[] = [
  {
    id: "s3",
    mode: "exam",
    timestamp: "2026-02-18T10:00:00.000Z",
    category: "All",
    score: 45,
    total: 60,
    percentage: 75,
    passed: true,
    timeSpentMs: 6_000,
    questions: [
      { questionId: "q1", userAnswer: "A", correctAnswer: "A", isCorrect: true, category: "Regulations" },
      { questionId: "q2", userAnswer: "B", correctAnswer: "C", isCorrect: false, category: "Airspace" },
    ],
  },
  {
    id: "s2",
    mode: "study",
    timestamp: "2026-02-17T10:00:00.000Z",
    category: "Regulations",
    score: 3,
    total: 5,
    percentage: 60,
    passed: false,
    timeSpentMs: 2_000,
    questions: [
      { questionId: "q3", userAnswer: "A", correctAnswer: "A", isCorrect: true, category: "Regulations" },
      { questionId: "q4", userAnswer: "D", correctAnswer: "D", isCorrect: true, category: "Regulations" },
      { questionId: "q5", userAnswer: "C", correctAnswer: "B", isCorrect: false, category: "Weather" },
    ],
  },
  {
    id: "s1",
    mode: "exam",
    timestamp: "2026-02-16T10:00:00.000Z",
    category: "All",
    score: 35,
    total: 60,
    percentage: 58,
    passed: false,
    timeSpentMs: 5_000,
    questions: [
      { questionId: "q6", userAnswer: "B", correctAnswer: "B", isCorrect: true, category: "Airspace" },
      { questionId: "q7", userAnswer: "A", correctAnswer: "C", isCorrect: false, category: "Weather" },
    ],
  },
];

describe("computeProgressStats", () => {
  it("computes aggregate totals and exam stats", () => {
    const stats = computeProgressStats(sessions, 70);

    expect(stats.totalSessions).toBe(3);
    expect(stats.totalQuestions).toBe(7);
    expect(stats.totalCorrect).toBe(4);
    expect(stats.overallAccuracy).toBe(57);
    expect(stats.examSessions).toBe(2);
    expect(stats.examPassRate).toBe(50);
    expect(stats.bestExamScore).toBe(75);
  });

  it("computes streaks using newest-first order", () => {
    const stats = computeProgressStats(sessions, 70);

    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
  });

  it("identifies weak categories below pass threshold", () => {
    const stats = computeProgressStats(sessions, 70);
    const weak = stats.weakSpots.map((w) => w.category);

    expect(weak).toContain("Weather");
    expect(weak).not.toContain("Regulations");
  });
});
