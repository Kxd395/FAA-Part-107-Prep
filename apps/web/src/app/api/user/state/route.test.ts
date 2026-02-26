import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { clearUserStateStoreForTests } from "../../../../lib/server/userStateStore";
import { GET, PUT } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("user state route", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearUserStateStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/state"));
    expect(response.status).toBe(401);
  });

  it("saves and reads per-user state", async () => {
    const putResponse = await PUT(
      new NextRequest("http://localhost/api/user/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("pilot_user_1"),
          "x-forwarded-for": "state-ip",
        },
        body: JSON.stringify({
          mode: "merge",
          data: {
            part107_progress: JSON.stringify([{ id: "session-1", timestamp: "2026-02-24T00:00:00.000Z" }]),
            part107_adaptive_stats_v2: null,
            part107_attempt_events_v1: null,
            part107_learning_events_v1: null,
            part107_flashcard_sr: null,
            part107_learn_draft_v1: null,
            part107_question_collections_v1: null,
          },
        }),
      })
    );
    expect(putResponse.status).toBe(200);
    const putBody = await putResponse.json();
    expect(putBody.userId).toBe("pilot_user_1");
    expect(putBody.changedKeys).toContain("part107_progress");

    const getResponse = await GET(
      new NextRequest("http://localhost/api/user/state", {
        headers: {
          cookie: authCookie("pilot_user_1"),
          "x-forwarded-for": "state-ip",
        },
      })
    );
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.userId).toBe("pilot_user_1");
    expect(getBody.data.part107_progress).toContain("session-1");
  });

  it("isolates records by user", async () => {
    await PUT(
      new NextRequest("http://localhost/api/user/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("user-a"),
        },
        body: JSON.stringify({
          mode: "overwrite",
          data: {
            part107_progress: JSON.stringify([{ id: "a-only", timestamp: "2026-02-24T00:00:00.000Z" }]),
          },
        }),
      })
    );

    const response = await GET(
      new NextRequest("http://localhost/api/user/state", {
        headers: {
          cookie: authCookie("user-b"),
        },
      })
    );
    expect(response.status).toBe(404);
  });

  it("preserves updatedAt when merge payload produces no changes", async () => {
    const initialPut = await PUT(
      new NextRequest("http://localhost/api/user/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("stable-user"),
        },
        body: JSON.stringify({
          mode: "overwrite",
          data: {
            part107_progress: JSON.stringify([{ id: "stable-1", timestamp: "2026-02-24T00:00:00.000Z" }]),
          },
        }),
      })
    );
    expect(initialPut.status).toBe(200);
    const initialBody = await initialPut.json();
    const updatedAtBefore = String(initialBody.updatedAt);

    const secondPut = await PUT(
      new NextRequest("http://localhost/api/user/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("stable-user"),
        },
        body: JSON.stringify({
          mode: "merge",
          data: {
            part107_progress: JSON.stringify([{ id: "stable-1", timestamp: "2026-02-24T00:00:00.000Z" }]),
          },
        }),
      })
    );
    expect(secondPut.status).toBe(200);
    const secondBody = await secondPut.json();
    expect(secondBody.changedKeys).toEqual([]);
    expect(secondBody.updatedAt).toBe(updatedAtBefore);
  });
});
