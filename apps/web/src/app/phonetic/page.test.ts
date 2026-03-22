import { describe, expect, it } from "vitest";
import { buildQuizQuestion, type PhoneticEntry } from "./page";

function makeEntry(character: string, word: string): PhoneticEntry {
  return {
    character,
    word,
    pronunciation: word.toUpperCase(),
    morse: null,
  };
}

describe("buildQuizQuestion", () => {
  it("returns exactly three answer choices", () => {
    const pool = [
      makeEntry("A", "Alfa"),
      makeEntry("B", "Bravo"),
      makeEntry("C", "Charlie"),
      makeEntry("D", "Delta"),
    ];

    const question = buildQuizQuestion(pool[1]!, pool);

    expect(question.options).toHaveLength(3);
    expect(question.options).toContain("Bravo");
  });

  it("uses nearby phonetic entries as distractors", () => {
    const pool = [
      makeEntry("W", "Whiskey"),
      makeEntry("X", "X-Ray"),
      makeEntry("Y", "Yankee"),
      makeEntry("Z", "Zulu"),
    ];

    const question = buildQuizQuestion(pool[3]!, pool);

    expect(question.options).toHaveLength(3);
    expect(question.options).toEqual(expect.arrayContaining(["Zulu", "Yankee", "X-Ray"]));
    expect(question.options).not.toContain("Whiskey");
  });
});
