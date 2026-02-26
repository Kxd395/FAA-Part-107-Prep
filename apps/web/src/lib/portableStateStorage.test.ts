import { beforeEach, describe, expect, it } from "vitest";
import { readPortableStateForUser, writePortableStateForUser } from "./portableStateStorage";

const PORTABLE_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
] as const;

describe("portableStateStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads progress from user-scoped storage key", () => {
    localStorage.setItem("part107_progress:pilot-a", JSON.stringify([{ id: "s1" }]));
    localStorage.setItem("part107_progress", JSON.stringify([{ id: "local" }]));

    const payload = readPortableStateForUser(PORTABLE_KEYS, "pilot-a");
    const sessions = JSON.parse(payload.part107_progress ?? "[]") as Array<{ id: string }>;

    expect(sessions).toEqual([{ id: "s1" }]);
  });

  it("reads flashcard schedule and learn draft from user-scoped keys", () => {
    localStorage.setItem("part107_flashcard_sr:pilot-a", JSON.stringify({ q1: { due: 123 } }));
    localStorage.setItem(
      "part107_learn_draft_v1:pilot-a",
      JSON.stringify({ version: 1, updatedAt: "2026-02-25T00:00:00.000Z" })
    );

    const payload = readPortableStateForUser(PORTABLE_KEYS, "pilot-a");
    const flashcard = JSON.parse(payload.part107_flashcard_sr ?? "{}") as Record<string, { due?: number }>;
    const draft = JSON.parse(payload.part107_learn_draft_v1 ?? "{}") as { version?: number };

    expect(flashcard.q1?.due).toBe(123);
    expect(draft.version).toBe(1);
  });

  it("reads only target-user bucket for shared adaptive/attempt/learning payloads", () => {
    localStorage.setItem(
      "part107_adaptive_stats_v2",
      JSON.stringify({
        version: 2,
        users: {
          "pilot-a": { q1: { attempts: 2 } },
          "pilot-b": { q1: { attempts: 5 } },
        },
      })
    );
    localStorage.setItem(
      "part107_attempt_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ attemptId: "a1", timestamp: "2026-02-25T00:00:00.000Z" }],
          "pilot-b": [{ attemptId: "b1", timestamp: "2026-02-25T00:00:00.000Z" }],
        },
      })
    );
    localStorage.setItem(
      "part107_learning_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ id: "e1", timestamp: "2026-02-25T00:00:00.000Z" }],
          "pilot-b": [{ id: "e2", timestamp: "2026-02-25T00:00:00.000Z" }],
        },
      })
    );

    const payload = readPortableStateForUser(PORTABLE_KEYS, "pilot-a");
    const adaptive = JSON.parse(payload.part107_adaptive_stats_v2 ?? "{}") as {
      users: Record<string, unknown>;
    };
    const attempts = JSON.parse(payload.part107_attempt_events_v1 ?? "{}") as {
      users: Record<string, unknown>;
    };
    const learning = JSON.parse(payload.part107_learning_events_v1 ?? "{}") as {
      users: Record<string, unknown>;
    };

    expect(Object.keys(adaptive.users)).toEqual(["pilot-a"]);
    expect(Object.keys(attempts.users)).toEqual(["pilot-a"]);
    expect(Object.keys(learning.users)).toEqual(["pilot-a"]);
  });

  it("writes scoped shared payloads without clobbering other local users", () => {
    localStorage.setItem(
      "part107_adaptive_stats_v2",
      JSON.stringify({
        version: 2,
        users: {
          "pilot-a": { q1: { attempts: 2 } },
          "pilot-b": { q1: { attempts: 5 } },
        },
      })
    );
    localStorage.setItem(
      "part107_attempt_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ attemptId: "a1", timestamp: "2026-02-25T00:00:00.000Z" }],
          "pilot-b": [{ attemptId: "b1", timestamp: "2026-02-25T00:00:00.000Z" }],
        },
      })
    );
    localStorage.setItem(
      "part107_learning_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ id: "e1", timestamp: "2026-02-25T00:00:00.000Z" }],
          "pilot-b": [{ id: "e2", timestamp: "2026-02-25T00:00:00.000Z" }],
        },
      })
    );

    writePortableStateForUser(PORTABLE_KEYS, "pilot-a", {
      part107_progress: JSON.stringify([{ id: "s-updated" }]),
      part107_adaptive_stats_v2: JSON.stringify({
        version: 2,
        users: {
          "pilot-a": { q1: { attempts: 10 } },
        },
      }),
      part107_attempt_events_v1: JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ attemptId: "a2", timestamp: "2026-02-26T00:00:00.000Z" }],
        },
      }),
      part107_learning_events_v1: JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ id: "e3", timestamp: "2026-02-26T00:00:00.000Z" }],
        },
      }),
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
    });

    const adaptive = JSON.parse(localStorage.getItem("part107_adaptive_stats_v2") ?? "{}") as {
      users: Record<string, Record<string, { attempts: number }>>;
    };
    const attempts = JSON.parse(localStorage.getItem("part107_attempt_events_v1") ?? "{}") as {
      users: Record<string, Array<{ attemptId: string }>>;
    };
    const learning = JSON.parse(localStorage.getItem("part107_learning_events_v1") ?? "{}") as {
      users: Record<string, Array<{ id: string }>>;
    };

    expect(adaptive.users["pilot-a"].q1.attempts).toBe(10);
    expect(adaptive.users["pilot-b"].q1.attempts).toBe(5);
    expect(attempts.users["pilot-a"][0]?.attemptId).toBe("a2");
    expect(attempts.users["pilot-b"][0]?.attemptId).toBe("b1");
    expect(learning.users["pilot-a"][0]?.id).toBe("e3");
    expect(learning.users["pilot-b"][0]?.id).toBe("e2");
  });

  it("removes only target-user bucket when scoped payload value is null", () => {
    localStorage.setItem(
      "part107_attempt_events_v1",
      JSON.stringify({
        version: 1,
        users: {
          "pilot-a": [{ attemptId: "a1", timestamp: "2026-02-25T00:00:00.000Z" }],
          "pilot-b": [{ attemptId: "b1", timestamp: "2026-02-25T00:00:00.000Z" }],
        },
      })
    );

    writePortableStateForUser(PORTABLE_KEYS, "pilot-a", {
      part107_progress: null,
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
    });

    const attempts = JSON.parse(localStorage.getItem("part107_attempt_events_v1") ?? "{}") as {
      users: Record<string, Array<{ attemptId: string }>>;
    };
    expect(attempts.users["pilot-a"]).toBeUndefined();
    expect(attempts.users["pilot-b"][0]?.attemptId).toBe("b1");
  });

  it("writes and clears user-scoped flashcard schedule and learn draft keys", () => {
    writePortableStateForUser(PORTABLE_KEYS, "pilot-a", {
      part107_progress: null,
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: JSON.stringify({ q1: { due: 999 } }),
      part107_learn_draft_v1: JSON.stringify({ version: 1, updatedAt: "2026-02-26T00:00:00.000Z" }),
    });

    expect(localStorage.getItem("part107_flashcard_sr:pilot-a")).toContain("q1");
    expect(localStorage.getItem("part107_learn_draft_v1:pilot-a")).toContain("updatedAt");

    writePortableStateForUser(PORTABLE_KEYS, "pilot-a", {
      part107_progress: null,
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
    });

    expect(localStorage.getItem("part107_flashcard_sr:pilot-a")).toBeNull();
    expect(localStorage.getItem("part107_learn_draft_v1:pilot-a")).toBeNull();
  });
});
