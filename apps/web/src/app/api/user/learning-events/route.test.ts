import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import {
  clearLearningAnalyticsStoreForTests,
  getLearningScoringSummary,
} from "../../../../lib/server/learningAnalyticsStore";
import { POST } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("user learning events route", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearLearningAnalyticsStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/learning-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: {} }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("accepts valid event payload and persists analytics row", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/learning-events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("pilot_user_1"),
          "x-forwarded-for": "analytics-ip",
        },
        body: JSON.stringify({
          event: {
            id: "evt-1",
            userId: "ignored-client-user",
            timestamp: "2026-02-26T00:00:00.000Z",
            type: "answer_submitted",
            mode: "study",
            questionId: "Q-1",
            isCorrect: true,
            metadata: {
              confidence: 5,
              answerChanged: false,
            },
          },
        }),
      })
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.accepted).toBe(true);

    const summary = await getLearningScoringSummary("pilot_user_1");
    expect(summary.answerCount).toBe(1);
    expect(summary.correctCount).toBe(1);
  });

  it("rejects invalid event payload", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/learning-events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("pilot_user_1"),
        },
        body: JSON.stringify({
          event: {
            id: "evt-1",
            timestamp: "not-a-date",
            type: "answer_submitted",
            mode: "study",
          },
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});
