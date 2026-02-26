import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as createSyncSession } from "./session/route";
import { POST as syncUpload } from "./upload/route";
import { GET as syncDownload } from "./download/route";
import { issueAppSessionToken } from "../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../lib/server/rateLimit";
import { clearSyncStoreForTests } from "../../../lib/server/syncStore";
import { resolveImportedData } from "../../../lib/progressImportMerge";

const SYNC_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
  "part107_question_collections_v1",
] as const;

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("sync roundtrip flow", () => {
  const originalSigningSecret = process.env.SYNC_SIGNING_SECRET;

  beforeEach(async () => {
    process.env.SYNC_SIGNING_SECRET = "test-sync-signing-secret";
    clearRateLimitStoreForTests();
    await clearSyncStoreForTests();
  });

  afterEach(() => {
    process.env.SYNC_SIGNING_SECRET = originalSigningSecret;
  });

  it("completes session->upload->download->import-apply flow", async () => {
    const sessionResponse = await createSyncSession(
      new NextRequest("http://localhost/api/sync/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "roundtrip-ip",
          cookie: authCookie("roundtrip-user"),
        },
      })
    );
    expect(sessionResponse.status).toBe(200);
    const sessionBody = await sessionResponse.json();
    const token = String(sessionBody.token ?? "");
    expect(token).toContain("sync.");

    const uploadResponse = await syncUpload(
      new NextRequest("http://localhost/api/sync/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-forwarded-for": "roundtrip-ip",
        },
        body: JSON.stringify({
          userId: "roundtrip-user",
          mode: "merge",
          snapshot: {
            version: 1,
            exportedAt: "2026-02-24T00:00:00.000Z",
            data: {
              part107_progress: JSON.stringify([
                { id: "remote-session", timestamp: "2026-02-24T00:00:00.000Z", score: 88 },
              ]),
              part107_adaptive_stats_v2: null,
              part107_attempt_events_v1: null,
              part107_learning_events_v1: null,
              part107_flashcard_sr: null,
              part107_learn_draft_v1: null,
              part107_question_collections_v1: null,
            },
          },
        }),
      })
    );
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await syncDownload(
      new NextRequest("http://localhost/api/sync/download?userId=roundtrip-user", {
        headers: {
          authorization: `Bearer ${token}`,
          "x-forwarded-for": "roundtrip-ip",
        },
      })
    );
    expect(downloadResponse.status).toBe(200);
    const downloadBody = await downloadResponse.json();
    expect(downloadBody.snapshot.data.part107_progress).toContain("remote-session");

    // Simulate local import-apply merge.
    const localBefore = {
      part107_progress: JSON.stringify([
        { id: "local-session", timestamp: "2026-02-23T00:00:00.000Z", score: 64 },
      ]),
      part107_adaptive_stats_v2: null,
      part107_attempt_events_v1: null,
      part107_learning_events_v1: null,
      part107_flashcard_sr: null,
      part107_learn_draft_v1: null,
      part107_question_collections_v1: null,
    };
    const resolved = resolveImportedData(
      downloadBody.snapshot.data,
      localBefore,
      SYNC_KEYS,
      "merge"
    );
    expect(resolved.resolvedData.part107_progress).toContain("remote-session");
    expect(resolved.resolvedData.part107_progress).toContain("local-session");
  });
});
