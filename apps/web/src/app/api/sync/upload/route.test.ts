import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSyncStoreForTests, getSyncedSnapshot } from "../../../../lib/server/syncStore";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { issueSyncSessionToken } from "../../../../lib/server/syncToken";
import { POST } from "./route";

function makeRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/sync/upload", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sync/upload", () => {
  const originalToken = process.env.SYNC_API_TOKEN;
  const originalSigningSecret = process.env.SYNC_SIGNING_SECRET;
  const originalSnapshotSecret = process.env.SYNC_SNAPSHOT_HMAC_SECRET;

  beforeEach(async () => {
    await clearSyncStoreForTests();
    clearRateLimitStoreForTests();
    delete process.env.SYNC_API_TOKEN;
    delete process.env.SYNC_SIGNING_SECRET;
    delete process.env.SYNC_SNAPSHOT_HMAC_SECRET;
  });

  afterEach(() => {
    process.env.SYNC_API_TOKEN = originalToken;
    process.env.SYNC_SIGNING_SECRET = originalSigningSecret;
    process.env.SYNC_SNAPSHOT_HMAC_SECRET = originalSnapshotSecret;
  });

  it("rejects unauthenticated requests", async () => {
    const response = await POST(
      makeRequest({
        userId: "u1",
        mode: "merge",
        snapshot: { version: 1, exportedAt: "2026-02-24T00:00:00.000Z", data: {} },
      })
    );
    expect(response.status).toBe(401);
  });

  it("stores merge payload for authenticated user", async () => {
    const response = await POST(
      makeRequest(
        {
          userId: "u1",
          mode: "merge",
          snapshot: {
            version: 1,
            exportedAt: "2026-02-24T00:00:00.000Z",
            data: {
              part107_progress: JSON.stringify([{ id: "s1", timestamp: "2026-02-24T00:00:00.000Z" }]),
            },
          },
        },
        { "x-sync-user-id": "u1" }
      )
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    const snapshot = await getSyncedSnapshot("u1");
    expect(snapshot?.snapshot.data.part107_progress).toContain("s1");
  });

  it("enforces bearer token when configured", async () => {
    process.env.SYNC_API_TOKEN = "secret";
    const response = await POST(
      makeRequest(
        {
          userId: "u1",
          mode: "merge",
          snapshot: { version: 1, exportedAt: "2026-02-24T00:00:00.000Z", data: {} },
        },
        { "x-sync-user-id": "u1", authorization: "Bearer wrong" }
      )
    );
    expect(response.status).toBe(401);
  });

  it("rejects invalid snapshot signature when configured", async () => {
    process.env.SYNC_SIGNING_SECRET = "sync-secret";
    process.env.SYNC_SNAPSHOT_HMAC_SECRET = "snap-secret";
    const sessionToken = issueSyncSessionToken("u1", "sync-secret");

    const response = await POST(
      makeRequest(
        {
          userId: "u1",
          mode: "merge",
          snapshot: {
            version: 1,
            exportedAt: "2026-02-24T00:00:00.000Z",
            signature: "invalid-signature",
            data: {},
          },
        },
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    expect(response.status).toBe(400);
  });
});
