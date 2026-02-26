import type { UserQuestionStats } from "@part107/core";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateLegacyLocalUserStateToUser } from "./localUserStateMigration";

function buildAdaptiveStat(
  userId: string,
  canonicalKey: string,
  attempts: number,
  lastAttemptAt: string
): UserQuestionStats {
  return {
    userId,
    canonicalKey,
    attempts,
    correct: attempts,
    incorrect: 0,
    correctStreak: attempts,
    lastAttemptAt,
    lastResultWasCorrect: true,
    masteryScore: attempts / 10,
  };
}

describe("localUserStateMigration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns no-op for local-user", () => {
    localStorage.setItem("part107_progress", JSON.stringify([{ id: "s1", timestamp: "2026-02-20T00:00:00.000Z" }]));

    const result = migrateLegacyLocalUserStateToUser("local-user");

    expect(result.migrated).toBe(false);
    expect(localStorage.getItem("part107_progress")).toBeTruthy();
  });

  it("migrates legacy progress key into user-scoped progress storage", () => {
    localStorage.setItem(
      "part107_progress",
      JSON.stringify([
        { id: "s1", timestamp: "2026-02-20T00:00:00.000Z", score: 50 },
        { id: "s2", timestamp: "2026-02-22T00:00:00.000Z", score: 60 },
      ])
    );
    localStorage.setItem(
      "part107_progress:pilot-a",
      JSON.stringify([
        { id: "s1", timestamp: "2026-02-23T00:00:00.000Z", score: 80 },
        { id: "s3", timestamp: "2026-02-21T00:00:00.000Z", score: 70 },
      ])
    );

    const result = migrateLegacyLocalUserStateToUser("pilot-a");
    const migrated = JSON.parse(localStorage.getItem("part107_progress:pilot-a") ?? "[]") as Array<{
      id: string;
      score: number;
    }>;

    expect(result.progress).toBe(true);
    expect(result.migrated).toBe(true);
    expect(localStorage.getItem("part107_progress")).toBeNull();
    expect(migrated).toHaveLength(3);
    expect(migrated.find((row) => row.id === "s1")?.score).toBe(80);
    expect(migrated.map((row) => row.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("migrates adaptive stats from local-user (v2 + legacy v1) into authenticated user", () => {
    localStorage.setItem(
      "part107_adaptive_stats_v2",
      JSON.stringify({
        version: 2,
        users: {
          "local-user": {
            q1: buildAdaptiveStat("local-user", "q1", 2, "2026-02-20T00:00:00.000Z"),
            q2: buildAdaptiveStat("local-user", "q2", 1, "2026-02-21T00:00:00.000Z"),
          },
          "pilot-a": {
            q1: buildAdaptiveStat("pilot-a", "q1", 3, "2026-02-19T00:00:00.000Z"),
          },
        },
      })
    );
    localStorage.setItem(
      "part107_adaptive_stats_v1",
      JSON.stringify({
        version: 1,
        userId: "local-user",
        statsByKey: {
          q3: buildAdaptiveStat("local-user", "q3", 4, "2026-02-22T00:00:00.000Z"),
        },
      })
    );

    const result = migrateLegacyLocalUserStateToUser("pilot-a");
    const payload = JSON.parse(localStorage.getItem("part107_adaptive_stats_v2") ?? "{}") as {
      users: Record<string, Record<string, UserQuestionStats>>;
    };

    expect(result.adaptive).toBe(true);
    expect(result.adaptiveLegacy).toBe(true);
    expect(payload.users["local-user"]).toBeUndefined();
    expect(payload.users["pilot-a"].q1.attempts).toBe(3);
    expect(payload.users["pilot-a"].q2.userId).toBe("pilot-a");
    expect(payload.users["pilot-a"].q3.userId).toBe("pilot-a");
    expect(localStorage.getItem("part107_adaptive_stats_v1")).toBeNull();
  });

  it("migrates attempt and learning events to authenticated user and removes local-user buckets", () => {
    localStorage.setItem(
      "part107_attempt_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "local-user": [
            { attemptId: "a1", timestamp: "2026-02-20T00:00:00.000Z" },
            { attemptId: "a2", timestamp: "2026-02-21T00:00:00.000Z" },
          ],
          "pilot-a": [{ attemptId: "a1", timestamp: "2026-02-22T00:00:00.000Z" }],
        },
      })
    );
    localStorage.setItem(
      "part107_learning_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "local-user": [
            { id: "e1", timestamp: "2026-02-20T00:00:00.000Z" },
            { id: "e2", timestamp: "2026-02-21T00:00:00.000Z" },
          ],
          "pilot-a": [{ id: "e1", timestamp: "2026-02-22T00:00:00.000Z" }],
        },
      })
    );

    const result = migrateLegacyLocalUserStateToUser("pilot-a");
    const attempts = JSON.parse(localStorage.getItem("part107_attempt_events_v1") ?? "{}") as {
      users: Record<string, Array<{ attemptId: string }>>;
    };
    const learning = JSON.parse(localStorage.getItem("part107_learning_events_v1") ?? "{}") as {
      users: Record<string, Array<{ id: string }>>;
    };

    expect(result.attempts).toBe(true);
    expect(result.learningEvents).toBe(true);
    expect(attempts.users["local-user"]).toBeUndefined();
    expect(learning.users["local-user"]).toBeUndefined();
    expect(attempts.users["pilot-a"]).toHaveLength(2);
    expect(learning.users["pilot-a"]).toHaveLength(2);
  });

  it("migrates global flashcard schedule and learn draft into user-scoped keys", () => {
    localStorage.setItem(
      "part107_flashcard_sr",
      JSON.stringify({
        q1: { due: 100, interval: 2, ease: 2.3 },
        q2: { due: 200, interval: 4, ease: 2.5 },
      })
    );
    localStorage.setItem(
      "part107_flashcard_sr:pilot-a",
      JSON.stringify({
        q1: { due: 300, interval: 6, ease: 2.6 },
      })
    );
    localStorage.setItem(
      "part107_learn_draft_v1",
      JSON.stringify({
        version: 1,
        updatedAt: "2026-02-25T10:00:00.000Z",
        phase: "quiz",
      })
    );
    localStorage.setItem(
      "part107_learn_draft_v1:pilot-a",
      JSON.stringify({
        version: 1,
        updatedAt: "2026-02-25T09:00:00.000Z",
        phase: "teach",
      })
    );

    const result = migrateLegacyLocalUserStateToUser("pilot-a");
    const flashcard = JSON.parse(localStorage.getItem("part107_flashcard_sr:pilot-a") ?? "{}") as Record<
      string,
      { due?: number }
    >;
    const draft = JSON.parse(localStorage.getItem("part107_learn_draft_v1:pilot-a") ?? "{}") as {
      phase?: string;
    };

    expect(result.flashcardSchedule).toBe(true);
    expect(result.learnDraft).toBe(true);
    expect(localStorage.getItem("part107_flashcard_sr")).toBeNull();
    expect(localStorage.getItem("part107_learn_draft_v1")).toBeNull();
    expect(flashcard.q1?.due).toBe(300);
    expect(flashcard.q2?.due).toBe(200);
    expect(draft.phase).toBe("quiz");
  });

  it("keeps user buckets isolated across sequential authenticated migrations", () => {
    localStorage.setItem(
      "part107_progress",
      JSON.stringify([{ id: "local-a", timestamp: "2026-02-20T00:00:00.000Z", score: 50 }])
    );
    migrateLegacyLocalUserStateToUser("pilot-a");

    localStorage.setItem(
      "part107_progress",
      JSON.stringify([{ id: "local-b", timestamp: "2026-02-21T00:00:00.000Z", score: 70 }])
    );
    migrateLegacyLocalUserStateToUser("pilot-b");

    const pilotA = JSON.parse(localStorage.getItem("part107_progress:pilot-a") ?? "[]") as Array<{
      id: string;
    }>;
    const pilotB = JSON.parse(localStorage.getItem("part107_progress:pilot-b") ?? "[]") as Array<{
      id: string;
    }>;

    expect(pilotA.map((session) => session.id)).toEqual(["local-a"]);
    expect(pilotB.map((session) => session.id)).toEqual(["local-b"]);
    expect(localStorage.getItem("part107_progress")).toBeNull();
  });
});
