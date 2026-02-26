#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const QUESTIONS_DIR = path.join(ROOT, "questions");
const REPORT_PATH = path.resolve(
  ROOT,
  "../../docs/ssot/review/CollectionHealthAudit.md"
);

const CATEGORY_BALANCE_WARNING_RATIO = 4;
const CONCEPT_KEY_COVERAGE_WARNING_PERCENT = 60;
const STALE_CITATION_YEAR_THRESHOLD = 2016;

const PLACEHOLDER_CITATION_PATTERNS = [
  /^\s*$/,
  /^tbd$/i,
  /^todo$/i,
  /^unknown$/i,
  /^n\/?a$/i,
  /^citation needed$/i,
  /^source needed$/i,
];

function listQuestionFiles() {
  return fs
    .readdirSync(QUESTIONS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function parseYears(value) {
  if (typeof value !== "string") return [];
  const years = [];
  const matches = value.match(/\b(19|20)\d{2}\b/g);
  if (!matches) return years;
  for (const raw of matches) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) years.push(parsed);
  }
  return years;
}

function analyze() {
  const files = listQuestionFiles();
  const errors = [];
  const warnings = [];
  const categoryCounts = new Map();
  const conceptKeyGroups = new Map();

  let totalQuestions = 0;
  let missingCitationCount = 0;
  let staleCitationCount = 0;
  let withConceptKeyCount = 0;

  for (const file of files) {
    const fullPath = path.join(QUESTIONS_DIR, file);
    const questions = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (!Array.isArray(questions)) {
      errors.push(`${file}: root must be an array.`);
      continue;
    }

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const where = `${file}#${index + 1} (${question.id ?? "unknown-id"})`;
      totalQuestions += 1;

      const category = typeof question.category === "string" ? question.category.trim() : "";
      if (category) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }

      const citation = typeof question.citation === "string" ? question.citation.trim() : "";
      const isMissingOrPlaceholder = PLACEHOLDER_CITATION_PATTERNS.some((pattern) =>
        pattern.test(citation)
      );
      if (isMissingOrPlaceholder) {
        missingCitationCount += 1;
        errors.push(`${where}: citation is missing or placeholder.`);
      } else if (citation.length < 10) {
        warnings.push(`${where}: citation appears low-specificity ("${citation}").`);
      }

      const citationYears = parseYears(citation);
      if (citationYears.length > 0 && Math.max(...citationYears) < STALE_CITATION_YEAR_THRESHOLD) {
        staleCitationCount += 1;
        warnings.push(
          `${where}: citation may be stale (latest cited year ${Math.max(...citationYears)}).`
        );
      }

      const conceptKey =
        typeof question.concept_key === "string" ? question.concept_key.trim().toLowerCase() : "";
      if (conceptKey) {
        withConceptKeyCount += 1;
        if (!conceptKeyGroups.has(conceptKey)) {
          conceptKeyGroups.set(conceptKey, []);
        }
        conceptKeyGroups.get(conceptKey).push(where);
      }
    }
  }

  const duplicateConceptKeys = Array.from(conceptKeyGroups.entries()).filter(
    ([, rows]) => rows.length > 1
  );
  if (duplicateConceptKeys.length > 0) {
    warnings.push(
      ...duplicateConceptKeys.map(
        ([conceptKey, rows]) =>
          `duplicate concept_key '${conceptKey}' appears ${rows.length} times: ${rows.join(", ")}`
      )
    );
  }

  const conceptCoveragePercent =
    totalQuestions === 0 ? 0 : Math.round((withConceptKeyCount / totalQuestions) * 100);
  if (conceptCoveragePercent < CONCEPT_KEY_COVERAGE_WARNING_PERCENT) {
    warnings.push(
      `concept_key coverage is ${conceptCoveragePercent}% (${withConceptKeyCount}/${totalQuestions}), below ${CONCEPT_KEY_COVERAGE_WARNING_PERCENT}% target.`
    );
  }

  const categoryEntries = Array.from(categoryCounts.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const categoryValues = categoryEntries.map(([, count]) => count);
  const maxCategoryCount = categoryValues.length > 0 ? Math.max(...categoryValues) : 0;
  const minCategoryCount = categoryValues.length > 0 ? Math.min(...categoryValues) : 0;
  const categoryImbalanceRatio =
    minCategoryCount > 0 ? Number((maxCategoryCount / minCategoryCount).toFixed(2)) : null;

  if (categoryImbalanceRatio && categoryImbalanceRatio > CATEGORY_BALANCE_WARNING_RATIO) {
    warnings.push(
      `category imbalance ratio is ${categoryImbalanceRatio} (max=${maxCategoryCount}, min=${minCategoryCount}), above ${CATEGORY_BALANCE_WARNING_RATIO}.`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    totalQuestions,
    filesAudited: files.length,
    categoryEntries,
    duplicateConceptKeys,
    conceptCoveragePercent,
    missingCitationCount,
    staleCitationCount,
    categoryImbalanceRatio,
    errors,
    warnings,
  };
}

function writeReport(summary) {
  const lines = [
    "# Collection Health Audit",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Question files audited: **${summary.filesAudited}**`,
    `- Total questions audited: **${summary.totalQuestions}**`,
    `- Concept-key coverage: **${summary.conceptCoveragePercent}%**`,
    `- Duplicate concept-key groups: **${summary.duplicateConceptKeys.length}**`,
    `- Missing/placeholder citations: **${summary.missingCitationCount}**`,
    `- Potentially stale citations: **${summary.staleCitationCount}**`,
    `- Category imbalance ratio (max/min): **${summary.categoryImbalanceRatio ?? "n/a"}**`,
    `- Errors: **${summary.errors.length}**`,
    `- Warnings: **${summary.warnings.length}**`,
    "",
    "## Rules enforced",
    "- Citation must not be missing or placeholder text.",
    `- Citations with latest year < ${STALE_CITATION_YEAR_THRESHOLD} are flagged as potentially stale.`,
    "- Duplicate `concept_key` groups are flagged for review.",
    `- Category imbalance ratio warning threshold: ${CATEGORY_BALANCE_WARNING_RATIO} (max/min).`,
    `- Concept-key coverage warning target: ${CONCEPT_KEY_COVERAGE_WARNING_PERCENT}%+.`,
    "",
    "## Category counts",
  ];

  if (summary.categoryEntries.length === 0) {
    lines.push("- None.");
  } else {
    for (const [category, count] of summary.categoryEntries) {
      lines.push(`- ${category}: ${count}`);
    }
  }

  lines.push("", "## Errors");
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

  lines.push("");
  fs.writeFileSync(REPORT_PATH, lines.join("\n"));
}

function main() {
  const summary = analyze();
  writeReport(summary);

  if (summary.errors.length > 0) {
    console.error(
      `Collection health audit failed with ${summary.errors.length} error(s). See ${REPORT_PATH}`
    );
    process.exit(1);
  }

  const warningSuffix =
    summary.warnings.length > 0 ? ` (${summary.warnings.length} warning(s))` : "";
  console.log(
    `Collection health audit passed${warningSuffix}. Report: ${REPORT_PATH}`
  );
}

main();
