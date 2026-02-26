import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSyncStoreForTests, getSyncedSnapshot, mergeAndSaveSnapshot } from "./syncStore";

describe("syncStore remote mode", () => {
  const originalRemoteUrl = process.env.SYNC_STORE_URL;
  const originalRemoteToken = process.env.SYNC_STORE_TOKEN;

  beforeEach(async () => {
    process.env.SYNC_STORE_URL = "https://sync-store.example.test";
    process.env.SYNC_STORE_TOKEN = "remote-token";
    await clearSyncStoreForTests();
  });

  afterEach(() => {
    process.env.SYNC_STORE_URL = originalRemoteUrl;
    process.env.SYNC_STORE_TOKEN = originalRemoteToken;
    vi.restoreAllMocks();
  });

  it("retries failed remote reads before succeeding", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("temporary network"))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const snapshot = await getSyncedSnapshot("u1");
    expect(snapshot).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens circuit breaker after repeated failures and short-circuits follow-up calls", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockRejectedValue(new Error("remote down"));

    await expect(getSyncedSnapshot("u1")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(getSyncedSnapshot("u1")).rejects.toThrow("circuit breaker is open");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries remote writes and persists once backend recovers", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("temporary put failure"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await mergeAndSaveSnapshot({
      userId: "u1",
      mode: "overwrite",
      snapshot: {
        version: 1,
        exportedAt: "2026-02-24T00:00:00.000Z",
        data: {
          part107_progress: JSON.stringify([{ id: "s1", timestamp: "2026-02-24T00:00:00.000Z" }]),
          part107_adaptive_stats_v2: null,
          part107_attempt_events_v1: null,
          part107_learning_events_v1: null,
          part107_flashcard_sr: null,
          part107_learn_draft_v1: null,
          part107_question_collections_v1: null,
        },
      },
    });

    expect(result.accepted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
