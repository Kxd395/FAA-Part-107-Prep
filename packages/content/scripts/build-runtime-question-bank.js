#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WEB_PUBLIC_DIR = path.join(REPO_ROOT, "apps/web/public");
const OUTPUT = path.join(REPO_ROOT, "packages/content/knowledge/runtime_question_bank.json");
const ARCHIVE_OUTPUT = path.join(
  REPO_ROOT,
  "packages/content/knowledge/archive/runtime_question_bank.review_archive.json"
);

const PART107_KEYWORDS = [
  /\bfaa\b/i,
  /\bpart\s*107\b/i,
  /\b14\s*cfr\b/i,
  /\bremote\s+pilot\b/i,
  /\bunmanned\b/i,
  /\buas\b/i,
  /\bsuas\b/i,
  /\bdrone\b/i,
  /\bremote\s+id\b/i,
  /\blaanc\b/i,
  /\bnotams?\b/i,
  /\btfrs?\b/i,
  /\batc\b/i,
  /\bmetar\b/i,
  /\btaf\b/i,
  /\bvlos\b/i,
  /\boperations?\s+over\s+people\b/i,
  /\banti-?collision\b/i,
  /\bwaiver\b/i,
  /\bclass\s*[abcde]\b/i,
  /\bairspace\b/i,
  /\bairport\b/i,
  /\bweather\b/i,
  /\bpre-?flight\b/i,
  /\bbattery\b/i,
  /\bload(?:ing)?\b/i,
  /\bcenter\s+of\s+gravity\b/i,
];

const GENERIC_BLOCKLIST = [
  /halo effect/i,
  /scenario analysis/i,
  /ethical decision-making/i,
  /psychological impact/i,
  /standards of ethical/i,
  /dynamic uas environments/i,
];

const PART107_CATEGORIES = new Set([
  "Regulations",
  "Airspace",
  "Weather",
  "Operations",
  "Loading & Performance",
  "Airport Operations",
  "Radio Communications",
  "Crew Resource Management",
  "Emergency Procedures",
  "Physiology",
  "Remote ID",
]);

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

function hasPart107Signal(question) {
  const blob = [
    question.question_text,
    question.citation,
    question.figure_reference,
    question.figure_text,
    question.source,
    question.source_type,
    question.category,
    question.subcategory,
    ...(Array.isArray(question.tags) ? question.tags : []),
    ...(Array.isArray(question.options) ? question.options.map((option) => option.text) : []),
  ]
    .filter(Boolean)
    .join(" ");

  return PART107_KEYWORDS.some((pattern) => pattern.test(blob));
}

function classifyQuestionForRuntime(question) {
  const reasons = [];

  if (GENERIC_BLOCKLIST.some((pattern) => pattern.test(question.question_text))) {
    reasons.push("generic_topic_blocked");
  }

  if (!PART107_CATEGORIES.has(question.category)) {
    reasons.push("non_part107_category");
  }

  if (!hasPart107Signal(question)) {
    reasons.push("part107_signal_missing");
  }

  return {
    keep: reasons.length === 0,
    reasons,
  };
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
  const archived = [];
  for (const question of merged) {
    const runtimeDecision = classifyQuestionForRuntime(question);
    if (!runtimeDecision.keep) {
      archived.push({
        question,
        reasons: runtimeDecision.reasons,
      });
      continue;
    }
    if (hasBrokenFigureDependency(question)) {
      archived.push({
        question,
        reasons: ["broken_figure_dependency"],
      });
      continue;
    }
    const key = questionSignature(question);
    if (seen.has(key)) {
      archived.push({
        question,
        reasons: ["duplicate_signature"],
      });
      continue;
    }
    seen.add(key);
    deduped.push(question);
  }
  return {
    runtimeQuestions: deduped,
    archivedQuestions: archived,
  };
}

function loadExistingRuntimeQuestions() {
  if (!fs.existsSync(OUTPUT)) return [];
  const loaded = loadQuestionArray(OUTPUT);
  return Array.isArray(loaded) ? loaded : [];
}

function loadCommittedRuntimeQuestions() {
  try {
    const serialized = execFileSync(
      "git",
      ["show", "HEAD:packages/content/knowledge/runtime_question_bank.json"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed) && parsed.every(isQuestionLike) ? parsed : [];
  } catch {
    return [];
  }
}

function appendRemovedLiveQuestions(runtimeQuestions, archivedQuestions) {
  const liveKeys = new Set(runtimeQuestions.map((question) => questionSignature(question)));
  const archivedKeys = new Set(archivedQuestions.map((entry) => questionSignature(entry.question)));
  const previousRuntimeQuestions = [
    ...loadExistingRuntimeQuestions(),
    ...loadCommittedRuntimeQuestions(),
  ];

  for (const question of previousRuntimeQuestions) {
    const key = questionSignature(question);
    if (liveKeys.has(key) || archivedKeys.has(key)) continue;
    archivedQuestions.push({
      question,
      reasons: ["removed_from_live_bank"],
    });
    archivedKeys.add(key);
  }
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const { runtimeQuestions, archivedQuestions } = buildRuntimeQuestions();
  appendRemovedLiveQuestions(runtimeQuestions, archivedQuestions);
  const nextSerialized = `${JSON.stringify(runtimeQuestions, null, 2)}\n`;
  const nextArchiveSerialized = `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runtimeQuestionCount: runtimeQuestions.length,
      archivedQuestionCount: archivedQuestions.length,
      archivedQuestions,
    },
    null,
    2
  )}\n`;

  if (checkOnly) {
    if (!fs.existsSync(OUTPUT)) {
      console.error(`Missing runtime bank artifact: ${OUTPUT}`);
      process.exit(1);
    }
    if (!fs.existsSync(ARCHIVE_OUTPUT)) {
      console.error(`Missing runtime review archive artifact: ${ARCHIVE_OUTPUT}`);
      process.exit(1);
    }
    const currentSerialized = fs.readFileSync(OUTPUT, "utf8");
    const currentArchive = JSON.parse(fs.readFileSync(ARCHIVE_OUTPUT, "utf8"));
    const currentArchiveSerialized = `${JSON.stringify(
      {
        ...currentArchive,
        generatedAt: "__IGNORED__",
      },
      null,
      2
    )}\n`;
    const comparableArchiveSerialized = `${JSON.stringify(
      {
        generatedAt: "__IGNORED__",
        runtimeQuestionCount: runtimeQuestions.length,
        archivedQuestionCount: archivedQuestions.length,
        archivedQuestions,
      },
      null,
      2
    )}\n`;
    if (currentSerialized !== nextSerialized) {
      console.error("Runtime bank is stale. Run: npm run build:runtime-bank --workspace=@part107/content");
      process.exit(1);
    }
    if (currentArchiveSerialized !== comparableArchiveSerialized) {
      console.error(
        "Runtime review archive is stale. Run: npm run build:runtime-bank --workspace=@part107/content"
      );
      process.exit(1);
    }
    console.log(
      `Runtime bank audit passed (${runtimeQuestions.length} live / ${archivedQuestions.length} archived): ${OUTPUT}`
    );
    return;
  }

  fs.writeFileSync(OUTPUT, nextSerialized);
  fs.mkdirSync(path.dirname(ARCHIVE_OUTPUT), { recursive: true });
  fs.writeFileSync(ARCHIVE_OUTPUT, nextArchiveSerialized);
  console.log(
    `Built runtime bank (${runtimeQuestions.length} live / ${archivedQuestions.length} archived): ${OUTPUT}`
  );
}

main();
