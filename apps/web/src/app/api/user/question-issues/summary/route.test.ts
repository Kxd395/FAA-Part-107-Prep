import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../../lib/server/rateLimit";
import {
  appendQuestionIssueReport,
  clearQuestionIssueStoreForTests,
} from "../../../../../lib/server/questionIssueStore";
import { GET } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("user question issue summary route", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearQuestionIssueStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/question-issues/summary"));
    expect(response.status).toBe(401);
  });

  it("returns triage summary for authenticated user", async () => {
    await appendQuestionIssueReport({
      id: "issue-1",
      userId: "pilot_user_1",
      createdAt: "2026-02-26T00:00:00.000Z",
      mode: "study",
      questionId: "Q-1",
      questionText: "Question 1",
      category: "Regulations",
      subcategory: "General",
      options: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
      ],
      correctOptionId: "A",
      note: "Issue one",
    });
    await appendQuestionIssueReport({
      id: "issue-2",
      userId: "pilot_user_1",
      createdAt: "2026-02-26T00:00:05.000Z",
      mode: "exam",
      questionId: "Q-1",
      questionText: "Question 1",
      category: "Regulations",
      subcategory: "General",
      options: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
      ],
      correctOptionId: "A",
      note: "Issue two",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/user/question-issues/summary?limit=5", {
        headers: {
          cookie: authCookie("pilot_user_1"),
          "x-forwarded-for": "issue-summary-ip",
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe("pilot_user_1");
    expect(body.limit).toBe(5);
    expect(body.summary.totalReports).toBe(2);
    expect(body.summary.uniqueQuestionCount).toBe(1);
    expect(body.summary.topQuestions[0].questionId).toBe("Q-1");
    expect(body.summary.topQuestions[0].reportCount).toBe(2);
  });
});
