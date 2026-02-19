import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type QuestionLike = {
  id: string;
  figure_reference?: string | null;
  figure_text?: string | null;
  image_ref?: string | null;
};

const CONTENT_FILES = [
  "regulations.json",
  "airspace.json",
  "weather.json",
  "loading_performance.json",
  "operations.json",
] as const;

function loadQuestions(): QuestionLike[] {
  const contentDir = path.resolve(process.cwd(), "../../packages/content/questions");
  return CONTENT_FILES.flatMap((filename) => {
    const fullPath = path.join(contentDir, filename);
    return JSON.parse(readFileSync(fullPath, "utf8")) as QuestionLike[];
  });
}

describe("question image assets", () => {
  it("has files for every explicit image_ref", () => {
    const publicDir = path.resolve(process.cwd(), "public");
    const missing = loadQuestions()
      .map((question) => {
        const ref = question.image_ref?.trim();
        if (!ref) return null;
        const relative = ref.startsWith("/") ? ref.slice(1) : ref;
        const assetPath = path.join(publicDir, relative);
        return existsSync(assetPath) ? null : `${question.id} -> ${ref}`;
      })
      .filter((item): item is string => Boolean(item));

    expect(missing).toEqual([]);
  });

  it("has fallback figure images when figure_text and image_ref are both missing", () => {
    const figuresDir = path.resolve(process.cwd(), "public/figures");
    const missing = loadQuestions()
      .map((question) => {
        const figureRef = question.figure_reference?.trim();
        if (!figureRef) return null;
        if (question.image_ref?.trim()) return null;
        if (question.figure_text?.trim()) return null;
        const assetPath = path.join(figuresDir, `${figureRef}.png`);
        return existsSync(assetPath) ? null : `${question.id} -> ${figureRef}`;
      })
      .filter((item): item is string => Boolean(item));

    expect(missing).toEqual([]);
  });
});
