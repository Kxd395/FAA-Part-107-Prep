import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import {
  clearUserProfileStoreForTests,
  findOrCreateUserByEmail,
} from "../../../../lib/server/userProfileStore";
import { GET, PATCH } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("/api/user/profile", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearUserProfileStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/profile"));
    expect(response.status).toBe(401);
  });

  it("returns current authenticated profile", async () => {
    const { profile } = await findOrCreateUserByEmail("pilot@example.com");
    const response = await GET(
      new NextRequest("http://localhost/api/user/profile", {
        headers: { cookie: authCookie(profile.id) },
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe(profile.id);
    expect(body.email).toBe("pilot@example.com");
  });

  it("updates profile displayName", async () => {
    const { profile } = await findOrCreateUserByEmail("pilot@example.com");
    const response = await PATCH(
      new NextRequest("http://localhost/api/user/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: authCookie(profile.id),
        },
        body: JSON.stringify({ displayName: "Captain Pilot" }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.displayName).toBe("Captain Pilot");
  });
});
