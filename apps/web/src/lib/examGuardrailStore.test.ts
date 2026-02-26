import { describe, expect, it } from "vitest";
import {
  readExamStrictConfirmedOnly,
  writeExamStrictConfirmedOnly,
} from "./examGuardrailStore";

describe("examGuardrailStore", () => {
  it("writes and reads strict-confirmed flag per user", () => {
    localStorage.clear();
    writeExamStrictConfirmedOnly("pilot-a", true);

    expect(readExamStrictConfirmedOnly("pilot-a")).toBe(true);
    expect(readExamStrictConfirmedOnly("pilot-b")).toBe(false);
  });

  it("stores false when disabled", () => {
    localStorage.clear();
    writeExamStrictConfirmedOnly("pilot-a", false);
    expect(readExamStrictConfirmedOnly("pilot-a")).toBe(false);
  });
});
