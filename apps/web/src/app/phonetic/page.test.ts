import { describe, expect, it } from "vitest";
import { buildPhoneticQuestion, type PhoneticEntry } from "../../lib/drills/phonetic";

function makeEntry(character: string, word: string): PhoneticEntry {
  return {
    character,
    word,
    pronunciation: word.toUpperCase(),
    morse: null,
  };
}

describe("buildPhoneticQuestion", () => {
  it("returns exactly three answer choices", () => {
    const pool = [
      makeEntry("A", "Alfa"),
      makeEntry("B", "Bravo"),
      makeEntry("C", "Charlie"),
      makeEntry("D", "Delta"),
    ];

    const question = buildPhoneticQuestion(pool[1]!, pool);

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

    const question = buildPhoneticQuestion(pool[3]!, pool);

    expect(question.options).toHaveLength(3);
    expect(question.options).toEqual(expect.arrayContaining(["Zulu", "Zebra", "Zenith"]));
    expect(question.options.every((option) => option.startsWith("Z"))).toBe(true);
  });

  it("falls back to nearby entries for digits", () => {
    const pool = [
      makeEntry("5", "Five"),
      makeEntry("6", "Six"),
      makeEntry("7", "Seven"),
      makeEntry("8", "Eight"),
    ];

    const question = buildPhoneticQuestion(pool[2]!, pool);

    expect(question.options).toHaveLength(3);
    expect(question.options).toEqual(expect.arrayContaining(["Seven", "Six", "Eight"]));
  });
});
