import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { clearSyncStoreForTests, mergeAndSaveSnapshot } from "../../../../lib/server/syncStore";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { GET } from "./route";

describe("GET /api/sync/download", () => {
  beforeEach(async () => {
    await clearSyncStoreForTests();
    clearRateLimitStoreForTests();
  });

  it("returns 401 without sync user header", async () => {
    const response = await GET(new NextRequest("http://localhost/api/sync/download"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when no snapshot exists", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/sync/download", {
        headers: { "x-sync-user-id": "u1" },
      })
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.snapshot).toBeNull();
  });

  it("returns snapshot for authenticated user", async () => {
    await mergeAndSaveSnapshot({
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

    const response = await GET(
      new NextRequest("http://localhost/api/sync/download?userId=u1", {
        headers: { "x-sync-user-id": "u1" },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe("u1");
    expect(body.snapshot.version).toBe(1);
    expect(body.snapshot.data.part107_progress).toContain("s1");
  });

  it("blocks cross-user reads", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/sync/download?userId=u2", {
        headers: { "x-sync-user-id": "u1" },
      })
    );
    expect(response.status).toBe(403);
  });
});
