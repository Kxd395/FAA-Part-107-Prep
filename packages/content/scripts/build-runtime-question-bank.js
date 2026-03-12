#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WEB_PUBLIC_DIR = path.join(REPO_ROOT, "apps/web/public");
const OUTPUT = path.join(REPO_ROOT, "packages/content/knowledge/runtime_question_bank.json");

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isQuestionLike(value) {
  if (!value || typeof value !== "object") return false;
  const row = value;
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

function loadQuestionArray(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const rows = loadJsonFile(filePath);
    if (!Array.isArray(rows)) return null;
    if (!rows.every(isQuestionLike)) return null;
    return rows;
  } catch {
    return null;
  }
}

function loadLocalCategorySupplement() {
  const localCategoryFiles = [
    path.join(REPO_ROOT, "packages/content/questions/airspace.json"),
    path.join(REPO_ROOT, "packages/content/questions/weather.json"),
    path.join(REPO_ROOT, "packages/content/questions/operations.json"),
    path.join(REPO_ROOT, "packages/content/questions/loading_performance.json"),
    path.join(REPO_ROOT, "packages/content/questions/airport_operations.json"),
    path.join(REPO_ROOT, "packages/content/questions/acronyms.json"),
    path.join(REPO_ROOT, "packages/content/questions/regulations_verified.json"),
    path.join(REPO_ROOT, "packages/content/questions/extended_terms.json"),
    path.join(REPO_ROOT, "packages/content/questions/practice_questions.json"),
    path.join(REPO_ROOT, "packages/content/questions/phonetic_alphabet.json"),
  ];

  const allowedRegulationsSubcategories = new Set([
    "Acronyms & Abbreviations",
    "Verified Rules",
    "Practice Questions",
    "Extended Terms",
  ]);

  return localCategoryFiles
    .map((filePath) => loadQuestionArray(filePath))
    .filter((rows) => Array.isArray(rows))
    .flat()
    .filter(
      (question) =>
        question.category !== "Regulations" ||
        allowedRegulationsSubcategories.has(question.subcategory)
    );
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function questionSignature(question) {
  const options = question.options
    .map((option) => normalizeText(option.text).replace(/^[a-d][).:-]\s*/i, ""))
    .sort();
  return `${normalizeText(question.question_text)}||${options.join("||")}`;
}

function isUnresolvedFigurePlaceholderText(value) {
  if (!value) return false;
  const normalized = String(value).replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return false;
  const withoutLabel = normalized.replace(/^(?:figure|fig\.?)\s*:?\s*/, "");
  return /^insert\b/.test(withoutLabel);
}

function hasResolvedFigureAsset(question) {
  const imageRef = typeof question.image_ref === "string" ? question.image_ref.trim() : "";
  if (imageRef.length > 0) {
    if (/^https?:\/\//i.test(imageRef)) return true;
    if (imageRef.startsWith("/")) {
      const assetPath = path.join(WEB_PUBLIC_DIR, imageRef.replace(/^\/+/, ""));
      return fs.existsSync(assetPath);
    }
    return true;
  }

  const figureReference =
    typeof question.figure_reference === "string" ? question.figure_reference.trim() : "";
  if (!figureReference) return false;
  if (/^figure-\d+-\d+$/i.test(figureReference)) {
    return fs.existsSync(
      path.join(
        WEB_PUBLIC_DIR,
        "figures",
        "rpsg-2016",
        `rpsg2016-${figureReference.toLowerCase()}.jpeg`
      )
    );
  }
  return fs.existsSync(path.join(WEB_PUBLIC_DIR, "figures", `${figureReference}.png`));
}

function hasBrokenFigureDependency(question) {
  const figureText = typeof question.figure_text === "string" ? question.figure_text.trim() : "";
  const imageRef = typeof question.image_ref === "string" ? question.image_ref.trim() : "";
  const figureReference =
    typeof question.figure_reference === "string" ? question.figure_reference.trim() : "";

  if (hasResolvedFigureAsset(question)) return false;
  if (figureText && !isUnresolvedFigurePlaceholderText(figureText)) return false;

  const hasFigureSignals =
    imageRef.length > 0 ||
    figureReference.length > 0 ||
    isUnresolvedFigurePlaceholderText(figureText);

  return hasFigureSignals;
}

function buildRuntimeQuestions() {
  const baseCandidates = [
    path.join(REPO_ROOT, "packages/content/knowledge/combined_question_bank.canonical.json"),
    path.join(REPO_ROOT, "docs/ssot/review/knokegeUpdate/combined_question_bank.json"),
  ];
  const supplementalCandidates = [
    path.join(REPO_ROOT, "packages/content/knowledge/knokegeupdate_question_bank.curated.json"),
  ];

  let baseQuestions = null;
  for (const filePath of baseCandidates) {
    const loaded = loadQuestionArray(filePath);
    if (loaded && loaded.length > 0) {
      baseQuestions = loaded;
      break;
    }
  }
  if (!baseQuestions) {
    throw new Error("No base combined question source found.");
  }

  const supplementalQuestions = supplementalCandidates
    .map((filePath) => loadQuestionArray(filePath))
    .filter((rows) => Array.isArray(rows))
    .flat();

  const merged = [...baseQuestions, ...loadLocalCategorySupplement(), ...supplementalQuestions];
  const seen = new Set();
  const deduped = [];
  for (const question of merged) {
    if (hasBrokenFigureDependency(question)) continue;
    const key = questionSignature(question);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(question);
  }
  return deduped;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const runtimeQuestions = buildRuntimeQuestions();
  const nextSerialized = `${JSON.stringify(runtimeQuestions, null, 2)}\n`;

  if (checkOnly) {
    if (!fs.existsSync(OUTPUT)) {
      console.error(`Missing runtime bank artifact: ${OUTPUT}`);
      process.exit(1);
    }
    const currentSerialized = fs.readFileSync(OUTPUT, "utf8");
    if (currentSerialized !== nextSerialized) {
      console.error("Runtime bank is stale. Run: npm run build:runtime-bank --workspace=@part107/content");
      process.exit(1);
    }
    console.log(`Runtime bank audit passed (${runtimeQuestions.length} questions): ${OUTPUT}`);
    return;
  }

  fs.writeFileSync(OUTPUT, nextSerialized);
  console.log(`Built runtime bank (${runtimeQuestions.length} questions): ${OUTPUT}`);
}

main();
