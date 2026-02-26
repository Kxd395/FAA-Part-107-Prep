import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Question } from "@part107/core";
import { isUnresolvedFigurePlaceholderText } from "../figurePlaceholder";

function loadJsonFile<T>(absolutePath: string): T {
  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

function loadQuestionArray(filePath: string): Question[] | null {
  try {
    const rows = loadJsonFile<unknown[]>(filePath);
    if (!Array.isArray(rows)) return null;
    if (!rows.every(isQuestionLike)) return null;
    return rows as Question[];
  } catch {
    return null;
  }
}

function loadLocalCategorySupplement(repoRoot: string): Question[] {
  const localCategoryFiles = [
    path.join(repoRoot, "packages/content/questions/airspace.json"),
    path.join(repoRoot, "packages/content/questions/weather.json"),
    path.join(repoRoot, "packages/content/questions/operations.json"),
    path.join(repoRoot, "packages/content/questions/loading_performance.json"),
  ];

  return localCategoryFiles
    .map((filePath) => loadQuestionArray(filePath))
    .filter((rows): rows is Question[] => Array.isArray(rows))
    .flat()
    .filter((question) => question.category !== "Regulations");
}

function isQuestionLike(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.category === "string" &&
    typeof row.subcategory === "string" &&
    typeof row.question_text === "string" &&
    Array.isArray(row.options) &&
    row.options.length >= 2 &&
    typeof row.correct_option_id === "string"
  );
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function signature(question: Question): string {
  const options = question.options
    .map((option) => normalizeText(option.text).replace(/^[a-d][).:-]\s*/i, ""))
    .sort();
  return `${normalizeText(question.question_text)}||${options.join("||")}`;
}

function hasResolvedFigureAsset(question: Question, webPublicDir: string): boolean {
  const imageRef = typeof question.image_ref === "string" ? question.image_ref.trim() : "";
  if (imageRef.length > 0) {
    if (/^https?:\/\//i.test(imageRef)) return true;
    if (imageRef.startsWith("/")) {
      const assetPath = path.join(webPublicDir, imageRef.replace(/^\/+/, ""));
      return existsSync(assetPath);
    }
    return true;
  }

  const figureReference = typeof question.figure_reference === "string" ? question.figure_reference.trim() : "";
  if (!figureReference) return false;
  if (/^figure-\d+-\d+$/i.test(figureReference)) {
    return existsSync(
      path.join(
        webPublicDir,
        "figures",
        "rpsg-2016",
        `rpsg2016-${figureReference.toLowerCase()}.jpeg`
      )
    );
  }
  return existsSync(path.join(webPublicDir, "figures", `${figureReference}.png`));
}

function hasBrokenFigureDependency(question: Question, webPublicDir: string): boolean {
  const figureText = typeof question.figure_text === "string" ? question.figure_text.trim() : "";
  const imageRef = typeof question.image_ref === "string" ? question.image_ref.trim() : "";
  const figureReference =
    typeof question.figure_reference === "string" ? question.figure_reference.trim() : "";
  if (hasResolvedFigureAsset(question, webPublicDir)) return false;

  if (figureText && !isUnresolvedFigurePlaceholderText(figureText)) return false;

  const hasFigureSignals =
    imageRef.length > 0 ||
    figureReference.length > 0 ||
    isUnresolvedFigurePlaceholderText(figureText);

  return hasFigureSignals;
}

function dedupeQuestions(questions: Question[], webPublicDir: string): Question[] {
  const seen = new Set<string>();
  const deduped: Question[] = [];
  for (const question of questions) {
    if (hasBrokenFigureDependency(question, webPublicDir)) continue;
    const key = signature(question);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(question);
  }
  return deduped;
}

export function loadCombinedQuestionBank(): Question[] {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const webPublicDir = path.join(repoRoot, "apps/web/public");
  const runtimeArtifactPath = path.join(
    repoRoot,
    "packages/content/knowledge/runtime_question_bank.json"
  );
  const runtimeArtifact = loadQuestionArray(runtimeArtifactPath);
  if (runtimeArtifact && runtimeArtifact.length > 0) {
    return runtimeArtifact;
  }
  const baseCandidates = [
    path.join(repoRoot, "packages/content/knowledge/combined_question_bank.canonical.json"),
    path.join(repoRoot, "docs/ssot/review/knokegeUpdate/combined_question_bank.json"),
  ];
  const supplementalCandidates = [
    path.join(repoRoot, "packages/content/knowledge/knokegeupdate_question_bank.curated.json"),
  ];

  let baseQuestions: Question[] | null = null;
  for (const filePath of baseCandidates) {
    const loaded = loadQuestionArray(filePath);
    if (!loaded) continue;
    baseQuestions = loaded;
    break;
  }

  if (!baseQuestions) return [];

  const supplementalQuestions = supplementalCandidates
    .map((filePath) => loadQuestionArray(filePath))
    .filter((rows): rows is Question[] => Array.isArray(rows))
    .flat();

  const localCategorySupplement = loadLocalCategorySupplement(repoRoot);

  return dedupeQuestions(
    [...baseQuestions, ...localCategorySupplement, ...supplementalQuestions],
    webPublicDir
  );
}
