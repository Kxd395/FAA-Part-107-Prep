import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAppSessionToken } from "../../../../lib/server/appAuth";
import { clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import {
  clearQuestionIssueStoreForTests,
  getQuestionIssueReports,
} from "../../../../lib/server/questionIssueStore";
import { POST } from "./route";

function authCookie(userId: string): string {
  const token = issueAppSessionToken(userId);
  return `part107_auth=${token}`;
}

describe("user question issues route", () => {
  beforeEach(async () => {
    clearRateLimitStoreForTests();
    await clearQuestionIssueStoreForTests();
  });

  it("returns 401 when unauthenticated", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/question-issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: {} }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("accepts valid report payload and persists it", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/question-issues", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("pilot_user_1"),
          "x-forwarded-for": "question-issue-ip",
        },
        body: JSON.stringify({
          report: {
            mode: "study",
            questionId: "Q-101",
            questionText: "Which answer is correct?",
            category: "Regulations",
            subcategory: "General",
            options: [
              { id: "A", text: "Option A" },
              { id: "B", text: "Option B" },
              { id: "C", text: "Option C" },
            ],
            correctOptionId: "A",
            selectedOptionId: "B",
            note: "This answer key looks incorrect.",
            questionTypeProfile: "confirmed_test",
            sourceType: "confirmed_test",
            confidence: 3,
            metadata: { surfacedVia: "inline_reporter" },
          },
        }),
      })
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.accepted).toBe(true);
    expect(typeof body.issueId).toBe("string");

    const reports = await getQuestionIssueReports("pilot_user_1");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.questionId).toBe("Q-101");
    expect(reports[0]?.note).toBe("This answer key looks incorrect.");
  });

  it("accepts flashcards mode reports", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/question-issues", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("pilot_user_2"),
          "x-forwarded-for": "question-issue-ip-2",
        },
        body: JSON.stringify({
          report: {
            mode: "flashcards",
            questionId: "Q-202",
            questionText: "Flashcards prompt",
            category: "Regulations",
            subcategory: "General",
            options: [
              { id: "A", text: "Option A" },
              { id: "B", text: "Option B" },
              { id: "C", text: "Option C" },
            ],
            correctOptionId: "A",
            selectedOptionId: null,
            note: "Needs clarification.",
          },
        }),
      })
    );

    expect(response.status).toBe(202);
    const reports = await getQuestionIssueReports("pilot_user_2");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.mode).toBe("flashcards");
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/user/question-issues", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie("pilot_user_1"),
        },
        body: JSON.stringify({
          report: {
            mode: "study",
            questionId: "",
            questionText: "bad",
            category: "Regulations",
            subcategory: "General",
            options: [{ id: "A", text: "Only one option" }],
            correctOptionId: "A",
            note: "",
          },
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});
