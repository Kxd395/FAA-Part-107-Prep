import { describe, expect, it, beforeEach } from "vitest";
import {
  clearStudyDraft,
  loadStudyDraft,
  saveStudyDraft,
  type StudyDraft,
} from "./studyDraftStore";

const sampleDraft: StudyDraft = {
  version: 1,
  updatedAt: "2026-02-26T00:00:00.000Z",
  selectedQuestionType: "confirmed_test",
  session: {
    selectedCategory: "Regulations",
    questions: [
      {
        id: "q1",
        category: "Regulations",
        subcategory: "General",
        question_text: "Question q1",
        figure_reference: null,
        options: [
          { id: "A", text: "A" },
          { id: "B", text: "B" },
          { id: "C", text: "C" },
        ],
        correct_option_id: "A",
        explanation_correct: "A",
        explanation_distractors: { B: "B", C: "C" },
        citation: "14 CFR",
        difficulty_level: 1,
        tags: [],
      },
    ],
    currentIndex: 0,
    selectedOption: null,
    answerState: "unanswered",
    score: { correct: 0, total: 0 },
    sessionStartTime: 1,
    questionResults: [],
    timeLimitMs: 0,
    remainingMs: 0,
    timedOut: false,
    lastStartOptions: { questionLimit: 20, timeLimitMs: null },
  },
};

describe("studyDraftStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads a user-scoped draft", () => {
    saveStudyDraft(sampleDraft, "pilot-a");
    const loaded = loadStudyDraft("pilot-a");
    expect(loaded?.selectedQuestionType).toBe("confirmed_test");
    expect(loaded?.session.questions[0]?.id).toBe("q1");
  });

  it("clears a saved draft", () => {
    saveStudyDraft(sampleDraft, "pilot-a");
    clearStudyDraft("pilot-a");
    expect(loadStudyDraft("pilot-a")).toBeNull();
  });
});

