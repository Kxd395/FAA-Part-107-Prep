import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { getAuthenticatedUserId, issueAppSessionToken } from "./appAuth";

describe("appAuth request token extraction", () => {
  it("authenticates from bearer token when cookie is absent", () => {
    const token = issueAppSessionToken("pilot_bearer_1");
    const request = new NextRequest("http://localhost/api/user/state", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(getAuthenticatedUserId(request)).toBe("pilot_bearer_1");
  });

  it("authenticates from x-part107-auth-token when cookie is absent", () => {
    const token = issueAppSessionToken("pilot_header_1");
    const request = new NextRequest("http://localhost/api/user/state", {
      headers: {
        "x-part107-auth-token": token,
      },
    });

    expect(getAuthenticatedUserId(request)).toBe("pilot_header_1");
  });
});
