import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { issueAppSessionToken } from "../../../../lib/server/appAuth";
import { DELETE, GET, POST } from "./route";

describe("auth session route", () => {
  beforeEach(() => {
    clearRateLimitStoreForTests();
  });

  it("creates session cookie for valid user", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "auth-ip" },
        body: JSON.stringify({ userId: "pilot_user_1" }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.userId).toBe("pilot_user_1");
    expect(response.headers.get("set-cookie")).toContain("part107_auth=");
  });

  it("rejects invalid userId", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "auth-ip" },
        body: JSON.stringify({ userId: "x" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns active session from cookie", async () => {
    const token = issueAppSessionToken("pilot_user_2");
    const response = await GET(
      new NextRequest("http://localhost/api/auth/session", {
        headers: {
          cookie: `part107_auth=${token}`,
        },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.userId).toBe("pilot_user_2");
  });

  it("marks session responses as no-store", async () => {
    const token = issueAppSessionToken("pilot_user_2");
    const response = await GET(
      new NextRequest("http://localhost/api/auth/session", {
        headers: {
          cookie: `part107_auth=${token}`,
        },
      })
    );

    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("clears session cookie on delete", async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("part107_auth=");
  });
});
