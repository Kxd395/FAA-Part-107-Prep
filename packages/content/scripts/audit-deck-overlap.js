#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const QUESTIONS_DIR = path.join(ROOT, "questions");
const MERGED_PATH = path.join(ROOT, "knowledge", "combined_question_bank.canonical.json");
const REPORT_PATH = path.resolve(ROOT, "../../docs/ssot/review/knokegeUpdate/DeckOverlapAudit.md");

const HIGH_OVERLAP_THRESHOLD = 0.58;
const TOP_PAIRS_LIMIT = 20;

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "with",
  "under",
  "part",
  "what",
  "which",
  "when",
  "where",
  "how",
  "is",
  "are",
  "does",
  "must",
  "may",
  "can",
  "should",
  "would",
  "be",
  "by",
  "from",
  "that",
  "if",
  "as",
  "it",
  "this",
]);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function listQuestionFiles() {
  return fs
    .readdirSync(QUESTIONS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function loadJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, "utf8"));
}

function questionSignature(question) {
  const stem = normalizeText(question.question_text);
  const options = (Array.isArray(question.options) ? question.options : [])
    .map((option) => normalizeText(option.text).replace(/^[a-d][).:-]\s*/i, ""))
    .sort();
  return `${stem}||${options.join("||")}`;
}

function tokenizeQuestion(question) {
  const text = `${question.question_text ?? ""} ${(Array.isArray(question.options)
    ? question.options.map((option) => option.text).join(" ")
    : "")}`;
  const tokens = normalizeText(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return new Set(tokens);
}

function jaccard(a, b) {
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function analyze() {
  const generatedAt = new Date().toISOString();
  const files = listQuestionFiles();
  const localQuestions = files.flatMap((file) => {
    const fullPath = path.join(QUESTIONS_DIR, file);
    const rows = loadJson(fullPath);
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({ ...row, __file: file, __index: index + 1 }));
  });

  if (!fs.existsSync(MERGED_PATH)) {
    return {
      generatedAt,
      localCount: localQuestions.length,
      mergedCount: 0,
      exactDuplicates: [],
      highOverlapPairs: [],
      topPairs: [],
      warnings: [
        `Merged canonical bank not found at ${MERGED_PATH}. Overlap scan skipped for merged source.`,
      ],
      errors: [],
    };
  }

  const mergedRows = loadJson(MERGED_PATH);
  const mergedQuestions = Array.isArray(mergedRows) ? mergedRows : [];

  const mergedBySignature = new Map();
  for (const question of mergedQuestions) {
    mergedBySignature.set(questionSignature(question), question);
  }

  const exactDuplicates = [];
  const mergedTokenCache = mergedQuestions.map((question) => ({
    question,
    tokens: tokenizeQuestion(question),
  }));

  const topPairs = [];
  const highOverlapPairs = [];

  for (const localQuestion of localQuestions) {
    const signature = questionSignature(localQuestion);
    if (mergedBySignature.has(signature)) {
      exactDuplicates.push({
        local: localQuestion,
        merged: mergedBySignature.get(signature),
      });
    }

    const localTokens = tokenizeQuestion(localQuestion);
    let best = { score: 0, merged: null };
    for (const row of mergedTokenCache) {
      const score = jaccard(localTokens, row.tokens);
      if (score > best.score) {
        best = { score, merged: row.question };
      }
    }

    if (best.merged) {
      const pair = {
        score: best.score,
        local: localQuestion,
        merged: best.merged,
      };
      topPairs.push(pair);
      if (best.score >= HIGH_OVERLAP_THRESHOLD) {
        highOverlapPairs.push(pair);
      }
    }
  }

  topPairs.sort((a, b) => b.score - a.score);
  highOverlapPairs.sort((a, b) => b.score - a.score);

  const errors = [];
  const warnings = [];

  if (exactDuplicates.length > 0) {
    errors.push(
      `Found ${exactDuplicates.length} exact duplicate question(s) between local category packs and merged canonical bank.`
    );
  }
  if (highOverlapPairs.length > 0) {
    warnings.push(
      `Found ${highOverlapPairs.length} high-overlap semantic pair(s) at threshold >= ${HIGH_OVERLAP_THRESHOLD}. Review for pruning.`
    );
  }

  return {
    generatedAt,
    localCount: localQuestions.length,
    mergedCount: mergedQuestions.length,
    exactDuplicates,
    highOverlapPairs,
    topPairs: topPairs.slice(0, TOP_PAIRS_LIMIT),
    warnings,
    errors,
  };
}

function writeReport(summary) {
  const lines = [
    "# Deck Overlap Audit",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Local category questions: **${summary.localCount}**`,
    `- Merged canonical questions: **${summary.mergedCount}**`,
    `- Exact duplicate pairs: **${summary.exactDuplicates.length}**`,
    `- High-overlap semantic pairs (>= ${HIGH_OVERLAP_THRESHOLD}): **${summary.highOverlapPairs.length}**`,
    `- Errors: **${summary.errors.length}**`,
    `- Warnings: **${summary.warnings.length}**`,
    "",
    "## Method",
    "- Exact duplicate check uses normalized `question_text + sorted options` signature.",
    "- Semantic similarity uses token Jaccard similarity over stem + options.",
    `- High-overlap threshold: ${HIGH_OVERLAP_THRESHOLD}.`,
    "",
    "## Errors",
  ];

  if (summary.errors.length === 0) {
    lines.push("- None.");
  } else {
    for (const error of summary.errors) {
      lines.push(`- ${error}`);
    }
  }

  lines.push("", "## Warnings");
  if (summary.warnings.length === 0) {
    lines.push("- None.");
  } else {
    for (const warning of summary.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("", "## Top similarity pairs (local -> merged)");
  if (summary.topPairs.length === 0) {
    lines.push("- None.");
  } else {
    for (const pair of summary.topPairs) {
      lines.push(
        `- score=${pair.score.toFixed(3)} | ${pair.local.id} -> ${pair.merged.id} | ${String(
          pair.local.question_text ?? ""
        ).slice(0, 120)}`
      );
    }
  }

  lines.push("");
  fs.writeFileSync(REPORT_PATH, lines.join("\n"));
}

function main() {
  const summary = analyze();
  writeReport(summary);

  if (summary.errors.length > 0) {
    console.error(`Deck overlap audit failed. See ${REPORT_PATH}`);
    process.exit(1);
  }

  const warningSuffix = summary.warnings.length > 0 ? ` (${summary.warnings.length} warning(s))` : "";
  console.log(`Deck overlap audit passed${warningSuffix}. Report: ${REPORT_PATH}`);
}

main();
