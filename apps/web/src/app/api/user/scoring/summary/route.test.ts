import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../../lib/server/rateLimit";
import {
  appendLearningAnalyticsEvent,
  clearLearningAnalyticsStoreForTests,
} from "../../../../../lib/server/learningAnalyticsStore";
import { GET } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("user scoring summary route", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearLearningAnalyticsStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/scoring/summary"));
    expect(response.status).toBe(401);
  });

  it("returns aggregate scoring summary for authenticated user", async () => {
    await appendLearningAnalyticsEvent({
      id: "evt-1",
      userId: "pilot_user_1",
      timestamp: "2026-02-26T00:00:00.000Z",
      type: "answer_submitted",
      mode: "study",
      questionId: "Q-1",
      isCorrect: false,
      metadata: { confidence: 5 },
    });
    await appendLearningAnalyticsEvent({
      id: "evt-2",
      userId: "pilot_user_1",
      timestamp: "2026-02-26T00:00:05.000Z",
      type: "answer_submitted",
      mode: "study",
      questionId: "Q-1",
      isCorrect: true,
      metadata: { confidence: 3 },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/user/scoring/summary?window=all", {
        headers: { cookie: authCookie("pilot_user_1"), "x-forwarded-for": "scoring-ip" },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe("pilot_user_1");
    expect(body.summary.answerCount).toBe(2);
    expect(body.summary.firstAnswerAccuracyPercent).toBe(0);
    expect(body.summary.finalAnswerAccuracyPercent).toBe(100);
    expect(body.summary.answerChangeRatePercent).toBe(100);
  });
});
