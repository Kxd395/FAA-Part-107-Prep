import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { verifySyncSessionToken } from "../../../../lib/server/syncToken";
import { POST } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("POST /api/sync/session", () => {
  const originalSecret = process.env.SYNC_SIGNING_SECRET;

  afterEach(() => {
    process.env.SYNC_SIGNING_SECRET = originalSecret;
    clearRateLimitStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    process.env.SYNC_SIGNING_SECRET = "secret";
    const response = await POST(
      new NextRequest("http://localhost/api/sync/session", {
        method: "POST",
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns null token when signing is not enabled", async () => {
    delete process.env.SYNC_SIGNING_SECRET;
    const response = await POST(
      new NextRequest("http://localhost/api/sync/session", {
        method: "POST",
        headers: { cookie: authCookie("local-user") },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBeNull();
    expect(body.userId).toBe("local-user");
  });

  it("issues a signed token for the authenticated user", async () => {
    process.env.SYNC_SIGNING_SECRET = "secret";
    const response = await POST(
      new NextRequest("http://localhost/api/sync/session", {
        method: "POST",
        headers: { cookie: authCookie("local-user") },
        body: JSON.stringify({ userId: "attacker-user" }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.token).toBe("string");
    expect(String(body.token)).toMatch(/^sync\./);
    expect(body.userId).toBe("local-user");
    expect(verifySyncSessionToken(String(body.token), "secret")?.userId).toBe("local-user");
  });
});
