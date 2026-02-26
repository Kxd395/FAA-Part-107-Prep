import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { clearUserProfileStoreForTests } from "../../../../lib/server/userProfileStore";
import { POST } from "./route";

const verifyIdTokenMock = vi.fn();

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: verifyIdTokenMock,
  })),
}));

describe("POST /api/auth/google", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearUserProfileStoreForTests();
    verifyIdTokenMock.mockReset();
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  });

  it("returns 400 when credential is missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 501 when Google auth is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const response = await POST(
      new NextRequest("http://localhost/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: "id-token" }),
      })
    );
    expect(response.status).toBe(501);
  });

  it("creates a session for a valid Google identity token", async () => {
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        email: "pilot@example.com",
        email_verified: true,
        name: "Pilot User",
        picture: "https://example.com/avatar.png",
      }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: "id-token" }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.email).toBe("pilot@example.com");
    expect(response.headers.get("set-cookie")).toContain("part107_auth=");
    expect(verifyIdTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ audience: ["google-client-id"] })
    );
  });

  it("accepts NEXT_PUBLIC_GOOGLE_CLIENT_ID as fallback audience", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "public-google-client-id";
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        email: "pilot@example.com",
        email_verified: true,
      }),
    });

    const response = await POST(
      new NextRequest("http://localhost/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: "id-token" }),
      })
    );

    expect(response.status).toBe(200);
    expect(verifyIdTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ audience: ["public-google-client-id"] })
    );
  });

  it("returns actionable mismatch guidance on audience errors outside production", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.GOOGLE_CLIENT_ID = "server-client-id";
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "browser-client-id";
    verifyIdTokenMock.mockRejectedValue(new Error("Wrong recipient, payload audience mismatch"));

    const response = await POST(
      new NextRequest("http://localhost/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: "id-token" }),
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/audience mismatch/i);
    consoleSpy.mockRestore();
  });
});
