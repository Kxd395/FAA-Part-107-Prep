import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/_internal/auth-config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns ok when required auth config is set", async () => {
    process.env.INTERNAL_METRICS_TOKEN = "internal-secret";
    process.env.APP_AUTH_SECRET = "secret";
    process.env.MAGIC_LINK_SECRET = "magic";
    process.env.APP_BASE_URL = "https://example.com";
    process.env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";

    const response = await GET(
      new NextRequest("http://localhost/api/_internal/auth-config?strict=1&production=1", {
        headers: { authorization: "Bearer internal-secret" },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.requestId).toBe("string");
  });

  it("returns 500 with explicit checks when config is incomplete", async () => {
    process.env.INTERNAL_METRICS_TOKEN = "internal-secret";
    delete process.env.APP_AUTH_SECRET;
    delete process.env.MAGIC_LINK_SECRET;
    delete process.env.APP_BASE_URL;
    delete process.env.APP_ALLOWED_ORIGINS;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.RESEND_API_KEY;

    const response = await GET(
      new NextRequest("http://localhost/api/_internal/auth-config?strict=1&production=1", {
        headers: { authorization: "Bearer internal-secret" },
      })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.checks)).toBe(true);
    const codes = body.checks.map((check: { code: string }) => check.code);
    expect(codes).toContain("APP_AUTH_SECRET_MISSING");
    expect(codes).toContain("MAGIC_LINK_SECRET_MISSING");
    expect(codes).toContain("APP_ORIGIN_MISSING");
  });
});
