import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { POST } from "./route";

describe("POST /api/sync/session", () => {
  const originalSecret = process.env.SYNC_SIGNING_SECRET;

  afterEach(() => {
    process.env.SYNC_SIGNING_SECRET = originalSecret;
    clearRateLimitStoreForTests();
  });

  it("returns null token when signing is not enabled", async () => {
    delete process.env.SYNC_SIGNING_SECRET;
    const response = await POST(
      new NextRequest("http://localhost/api/sync/session", {
        method: "POST",
        body: JSON.stringify({ userId: "local-user" }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBeNull();
  });

  it("issues a signed token when signing secret is configured", async () => {
    process.env.SYNC_SIGNING_SECRET = "secret";
    const response = await POST(
      new NextRequest("http://localhost/api/sync/session", {
        method: "POST",
        body: JSON.stringify({ userId: "local-user" }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.token).toBe("string");
    expect(String(body.token)).toMatch(/^sync\./);
  });
});
