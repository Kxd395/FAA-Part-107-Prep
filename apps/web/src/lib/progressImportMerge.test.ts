import { describe, expect, it } from "vitest";
import { computeImportPreview, resolveImportedData } from "./progressImportMerge";

const KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
  "part107_question_collections_v1",
] as const;

describe("progressImportMerge", () => {
  it("overwrites all keys exactly when overwrite mode is selected", () => {
    const current = {
      part107_progress: JSON.stringify([{ id: "s1", timestamp: "2026-02-20T00:00:00.000Z" }]),
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
      part107_question_collections_v1: null,
    };
    const incoming = {
      ...current,
      part107_progress: null,
    };

    const result = resolveImportedData(incoming, current, KEYS, "overwrite");

    expect(result.resolvedData.part107_progress).toBeNull();
    expect(result.changedKeys).toContain("part107_progress");
  });

  it("merges progress sessions by id and keeps the newest timestamp", () => {
    const current = {
      part107_progress: JSON.stringify([
        { id: "s1", timestamp: "2026-02-20T00:00:00.000Z", score: 40 },
        { id: "s2", timestamp: "2026-02-21T00:00:00.000Z", score: 50 },
      ]),
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
      part107_question_collections_v1: null,
    };
    const incoming = {
      ...current,
      part107_progress: JSON.stringify([
        { id: "s1", timestamp: "2026-02-22T00:00:00.000Z", score: 60 },
        { id: "s3", timestamp: "2026-02-23T00:00:00.000Z", score: 70 },
      ]),
    };

    const result = resolveImportedData(incoming, current, KEYS, "merge");
    const merged = JSON.parse(result.resolvedData.part107_progress ?? "[]") as Array<{ id: string; score: number }>;

    expect(merged).toHaveLength(3);
    expect(merged.find((row) => row.id === "s1")?.score).toBe(60);
    expect(result.changedKeys).toContain("part107_progress");
  });

  it("merges adaptive stats using attempts and recency preference", () => {
    const current = {
      part107_progress: null,
      part107_adaptive_stats_v2: JSON.stringify({
        version: 2,
        users: {
          "local-user": {
            q1: { attempts: 3, lastAttemptAt: "2026-02-20T00:00:00.000Z" },
          },
        },
      }),
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
      part107_question_collections_v1: null,
    };
    const incoming = {
      ...current,
      part107_adaptive_stats_v2: JSON.stringify({
        version: 2,
        users: {
          "local-user": {
            q1: { attempts: 5, lastAttemptAt: "2026-02-19T00:00:00.000Z" },
          },
        },
      }),
    };

    const result = resolveImportedData(incoming, current, KEYS, "merge");
    const merged = JSON.parse(result.resolvedData.part107_adaptive_stats_v2 ?? "{}") as {
      users: Record<string, Record<string, { attempts?: number }>>;
    };

    expect(merged.users["local-user"].q1.attempts).toBe(5);
  });

  it("computes preview with included and changed keys", () => {
    const current = {
      part107_progress: null,
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
      part107_question_collections_v1: null,
    };
    const incoming = {
      ...current,
      part107_progress: JSON.stringify([{ id: "s1", timestamp: "2026-02-20T00:00:00.000Z" }]),
    };

    const preview = computeImportPreview(incoming, current, KEYS, "merge");

    expect(preview.includedKeys).toContain("part107_progress");
    expect(preview.changedKeys).toContain("part107_progress");
  });
});
