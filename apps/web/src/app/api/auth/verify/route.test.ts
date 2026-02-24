import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { createMagicLinkToken } from "../../../../lib/server/passwordAuth";
import { clearUserProfileStoreForTests } from "../../../../lib/server/userProfileStore";
import { POST } from "./route";

describe("POST /api/auth/verify", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearUserProfileStoreForTests();
  });

  it("returns 401 for invalid token", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "bad-token" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("creates session cookie for valid magic-link token", async () => {
    const token = createMagicLinkToken("pilot@example.com");
    const response = await POST(
      new NextRequest("http://localhost/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.email).toBe("pilot@example.com");
    expect(response.headers.get("set-cookie")).toContain("part107_auth=");
  });
});
