import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLink } from "../../../../lib/server/passwordAuth";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { POST } from "./route";

vi.mock("../../../../lib/server/passwordAuth", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/server/passwordAuth")>(
    "../../../../lib/server/passwordAuth"
  );
  return {
    ...actual,
    sendMagicLink: vi.fn(async () => ({ sent: true })),
  };
});

describe("POST /api/auth/magic-link", () => {
  const originalBaseUrl = process.env.APP_BASE_URL;
  const originalAllowedOrigins = process.env.APP_ALLOWED_ORIGINS;

  beforeEach(() => {
    clearRateLimitStoreForTests();
    delete process.env.APP_BASE_URL;
    delete process.env.APP_ALLOWED_ORIGINS;
    vi.mocked(sendMagicLink).mockClear();
  });

  afterEach(() => {
    process.env.APP_BASE_URL = originalBaseUrl;
    process.env.APP_ALLOWED_ORIGINS = originalAllowedOrigins;
  });

  it("returns 400 for invalid email", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "bad-email" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("accepts valid email", async () => {
    process.env.APP_BASE_URL = "https://app.example.com";
    const response = await POST(
      new NextRequest("http://localhost/api/auth/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
          "x-forwarded-proto": "http",
        },
        body: JSON.stringify({ email: "pilot@example.com" }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sent).toBe(true);
    expect(sendMagicLink).toHaveBeenCalledWith("pilot@example.com", "https://app.example.com");
  });

  it("returns 500 when origin config is missing and request host is not local", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "evil.example.com",
          "x-forwarded-proto": "https",
        },
        body: JSON.stringify({ email: "pilot@example.com" }),
      })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("origin");
  });
});
