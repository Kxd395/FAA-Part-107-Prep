import { describe, expect, it } from "vitest";
import {
  readPreferredQuestionType,
  writePreferredQuestionType,
} from "./questionTypePreferenceStore";

describe("questionTypePreferenceStore", () => {
  it("writes and reads user-scoped preferred question type", () => {
    localStorage.clear();
    writePreferredQuestionType("pilot-a", "weak_spots");

    expect(readPreferredQuestionType("pilot-a")).toBe("weak_spots");
    expect(readPreferredQuestionType("pilot-b")).toBeNull();
  });

  it("returns null for unsupported stored values", () => {
    localStorage.clear();
    localStorage.setItem("part107_default_question_type_v1:pilot-a", "acs_practice");
    expect(readPreferredQuestionType("pilot-a")).toBeNull();
  });
});
