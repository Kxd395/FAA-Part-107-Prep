import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    clearRateLimitStoreForTests();
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
  });
});
