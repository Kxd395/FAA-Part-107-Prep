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

  it("merges against existing remote snapshot in merge mode", async () => {
    const existingRecord = {
      userId: "u1",
      updatedAt: "2026-02-23T00:00:00.000Z",
      snapshot: {
        version: 1 as const,
        exportedAt: "2026-02-23T00:00:00.000Z",
        data: {
          part107_progress: JSON.stringify([
            { id: "s-existing", timestamp: "2026-02-23T00:00:00.000Z" },
          ]),
          part107_adaptive_stats_v2: null,
          part107_attempt_events_v1: null,
          part107_learning_events_v1: null,
          part107_flashcard_sr: null,
          part107_learn_draft_v1: null,
          part107_question_collections_v1: null,
        },
      },
    };
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(existingRecord), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await mergeAndSaveSnapshot({
      userId: "u1",
      mode: "merge",
      snapshot: {
        version: 1,
        exportedAt: "2026-02-24T00:00:00.000Z",
        data: {
          part107_progress: JSON.stringify([
            { id: "s-incoming", timestamp: "2026-02-24T00:00:00.000Z" },
          ]),
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

    const putCall = fetchMock.mock.calls[1];
    const putInit = putCall?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(putInit?.body ?? "{}")) as {
      snapshot?: { data?: Record<string, string | null> };
    };
    const mergedProgress = JSON.parse(body.snapshot?.data?.part107_progress ?? "[]") as Array<{
      id?: string;
    }>;
    expect(mergedProgress.map((entry) => entry.id)).toEqual(["s-incoming", "s-existing"]);
  });
});
