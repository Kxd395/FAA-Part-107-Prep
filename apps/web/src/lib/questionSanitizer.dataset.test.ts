import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Question } from "@part107/core";
import { sanitizeQuestion } from "./questionSanitizer";

const CONTENT_FILES = [
  "regulations.json",
  "airspace.json",
  "weather.json",
  "loading_performance.json",
  "operations.json",
] as const;

function loadQuestions(): Question[] {
  const contentDir = path.resolve(process.cwd(), "../../packages/content/questions");
  return CONTENT_FILES.flatMap((filename) => {
    const fullPath = path.join(contentDir, filename);
    return JSON.parse(readFileSync(fullPath, "utf8")) as Question[];
  });
}

describe("question sanitizer dataset guard", () => {
  it("removes OCR strip image refs from sanitized payloads", () => {
    const leaking = loadQuestions()
      .map((question) => sanitizeQuestion(question))
      .filter((question) => question.image_ref?.startsWith("/images/uas-acsocr/"))
      .map((question) => question.id);

    expect(leaking).toEqual([]);
  });
});
