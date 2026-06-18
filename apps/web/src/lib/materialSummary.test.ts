import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { countQuestionsByCategory, type AppQuestion } from "./questionBank";
import { MATERIAL_SUMMARY } from "./materialSummary";

describe("material summary", () => {
  it("matches the generated runtime question bank", () => {
    const bankPath = path.resolve(
      process.cwd(),
      "../../packages/content/knowledge/runtime_question_bank.json"
    );
    const questions = JSON.parse(readFileSync(bankPath, "utf8")) as AppQuestion[];

    expect(MATERIAL_SUMMARY.totalQuestions).toBe(questions.length);
    expect(MATERIAL_SUMMARY.counts).toEqual(countQuestionsByCategory(questions));
  });
});
