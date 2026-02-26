import { beforeEach, describe, expect, it } from "vitest";
import {
  appendQuestionIssueReport,
  clearQuestionIssueStoreForTests,
  getQuestionIssueReports,
  getQuestionIssueTriageSummary,
} from "./questionIssueStore";

describe("questionIssueStore", () => {
  beforeEach(async () => {
    await clearQuestionIssueStoreForTests();
  });

  it("persists and returns reports for each user", async () => {
    await appendQuestionIssueReport({
      id: "issue-1",
      userId: "pilot_1",
      createdAt: "2026-02-26T00:00:00.000Z",
      mode: "study",
      questionId: "Q-1",
      questionText: "Question 1",
      category: "Regulations",
      subcategory: "General",
      options: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
        { id: "C", text: "C" },
      ],
      correctOptionId: "A",
      selectedOptionId: "B",
      note: "Correct answer appears wrong.",
      questionTypeProfile: "confirmed_test",
      confidence: 3,
    });
    await appendQuestionIssueReport({
      id: "issue-2",
      userId: "pilot_2",
      createdAt: "2026-02-26T00:00:01.000Z",
      mode: "exam",
      questionId: "Q-2",
      questionText: "Question 2",
      category: "Airspace",
      subcategory: "Class C",
      options: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
      ],
      correctOptionId: "B",
      note: "Source looks outdated.",
    });

    const firstUser = await getQuestionIssueReports("pilot_1");
    const secondUser = await getQuestionIssueReports("pilot_2");
    expect(firstUser).toHaveLength(1);
    expect(secondUser).toHaveLength(1);
    expect(firstUser[0]?.questionId).toBe("Q-1");
    expect(secondUser[0]?.questionId).toBe("Q-2");
  });

  it("de-duplicates by report id and keeps most recent payload", async () => {
    await appendQuestionIssueReport({
      id: "issue-1",
      userId: "pilot_1",
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
      note: "Old note",
    });
    await appendQuestionIssueReport({
      id: "issue-1",
      userId: "pilot_1",
      createdAt: "2026-02-26T00:00:05.000Z",
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
      note: "New note",
    });

    const reports = await getQuestionIssueReports("pilot_1");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.note).toBe("New note");
  });

  it("builds triage summary with top questions and mode/category counts", async () => {
    await appendQuestionIssueReport({
      id: "issue-1",
      userId: "pilot_1",
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
      note: "Old note",
    });
    await appendQuestionIssueReport({
      id: "issue-2",
      userId: "pilot_1",
      createdAt: "2026-02-26T00:00:05.000Z",
      mode: "exam",
      questionId: "Q-1",
      questionText: "Question 1 updated",
      category: "Regulations",
      subcategory: "General",
      options: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
      ],
      correctOptionId: "A",
      note: "Newest note",
    });
    await appendQuestionIssueReport({
      id: "issue-3",
      userId: "pilot_1",
      createdAt: "2026-02-26T00:00:02.000Z",
      mode: "learn",
      questionId: "Q-2",
      questionText: "Question 2",
      category: "Airspace",
      subcategory: "Class D",
      options: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
      ],
      correctOptionId: "B",
      note: "Airspace issue",
    });

    const summary = await getQuestionIssueTriageSummary("pilot_1", { limit: 1 });
    expect(summary.totalReports).toBe(3);
    expect(summary.uniqueQuestionCount).toBe(2);
    expect(summary.byMode.study).toBe(1);
    expect(summary.byMode.exam).toBe(1);
    expect(summary.byMode.learn).toBe(1);
    expect(summary.byCategory.Regulations).toBe(2);
    expect(summary.byCategory.Airspace).toBe(1);
    expect(summary.topQuestions).toHaveLength(1);
    expect(summary.topQuestions[0]?.questionId).toBe("Q-1");
    expect(summary.topQuestions[0]?.reportCount).toBe(2);
    expect(summary.topQuestions[0]?.latestNote).toBe("Newest note");
    expect(summary.topQuestions[0]?.byMode.study).toBe(1);
    expect(summary.topQuestions[0]?.byMode.exam).toBe(1);
  });
});
