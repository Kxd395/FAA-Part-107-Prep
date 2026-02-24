import { describe, expect, it } from "vitest";
import {
  parseQuestionApiResponse,
  parseRemoteQuestionSourcePayload,
} from "./questionContracts";

const sampleQuestion = {
  id: "Q-1",
  category: "Airspace",
  subcategory: "Class C",
  question_text: "What is required?",
  figure_reference: null,
  options: [
    { id: "A", text: "Option A" },
    { id: "B", text: "Option B" },
    { id: "C", text: "Option C" },
    { id: "D", text: "Option D" },
  ],
  correct_option_id: "C",
  explanation_correct: "Because of rules.",
  explanation_distractors: {},
  citation: "14 CFR 107.41",
  difficulty_level: 2,
  tags: [],
};

describe("questionContracts", () => {
  it("parses valid /api/questions payloads", () => {
    const payload = parseQuestionApiResponse({
      questions: [sampleQuestion],
      meta: {
        total: 1,
        category: "All",
        shuffled: false,
        limit: null,
        source: "local",
      },
    });

    expect(payload.questions).toHaveLength(1);
    expect(payload.meta.source).toBe("local");
  });

  it("rejects invalid /api/questions payloads", () => {
    expect(() => parseQuestionApiResponse({ questions: [{ bad: true }] })).toThrow(
      /invalid/i
    );
  });

  it("parses remote source array and object payload variants", () => {
    expect(parseRemoteQuestionSourcePayload([sampleQuestion])).toHaveLength(1);
    expect(parseRemoteQuestionSourcePayload({ questions: [sampleQuestion] })).toHaveLength(1);
  });

  it("rejects malformed remote source payload", () => {
    expect(() => parseRemoteQuestionSourcePayload({ questions: [{ id: "bad" }] })).toThrow(
      /invalid question entries/i
    );
  });
});
