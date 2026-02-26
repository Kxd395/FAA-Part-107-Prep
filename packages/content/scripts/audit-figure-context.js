#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const QUESTIONS_DIR = path.join(ROOT, "questions");
const WEB_PUBLIC_DIR = path.resolve(ROOT, "../../apps/web/public");
const REPORT_PATH = path.resolve(
  ROOT,
  "../../docs/ssot/review/FigureContextAudit.md"
);

const FIGURE_REF_FROM_TEXT = /figure\s+(\d+)/i;
const REFER_PROMPT_PATTERN =
  /\(refer to\s+faa-ct-8080-2h,\s*figure\s+(\d+)(?:,\s*area\s*\d+)?\.\)/i;

function listQuestionFiles() {
  return fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function normalizeFigureRef(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/figure-(\d+)/);
  return match ? `figure-${match[1]}` : null;
}

function expectedFigureRefFromQuestionText(questionText) {
  if (typeof questionText !== "string") return null;
  const m = questionText.match(REFER_PROMPT_PATTERN);
  if (!m) return null;
  return `figure-${m[1]}`;
}

function resolveRelativePublicAsset(assetPath) {
  if (!assetPath || typeof assetPath !== "string") return null;
  const trimmed = assetPath.trim();
  if (!trimmed) return null;
  const relative = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return path.join(WEB_PUBLIC_DIR, relative);
}

function hasUsableVisualContext(question, figureRef) {
  const explicitImage = resolveRelativePublicAsset(question.image_ref);
  if (explicitImage && fs.existsSync(explicitImage)) return true;

  if (figureRef) {
    const figureImage = path.join(WEB_PUBLIC_DIR, "figures", `${figureRef}.png`);
    if (fs.existsSync(figureImage)) return true;
  }

  if (typeof question.figure_text === "string" && question.figure_text.trim().length > 0) return true;

  return false;
}

function auditQuestions() {
  const files = listQuestionFiles();
  const issues = [];
  let total = 0;
  let withFigureRef = 0;
  let withReferPrompt = 0;
  let withUsableVisualContext = 0;

  for (const file of files) {
    const fullPath = path.join(QUESTIONS_DIR, file);
    const questions = JSON.parse(fs.readFileSync(fullPath, "utf8"));

    questions.forEach((q, idx) => {
      total += 1;
      const where = `${file}#${idx + 1} (${q.id})`;
      const figureRef = normalizeFigureRef(q.figure_reference);
      const expectedFromPrompt = expectedFigureRefFromQuestionText(q.question_text);
      const hasReferPrompt = !!expectedFromPrompt;

      if (figureRef) withFigureRef += 1;
      if (hasReferPrompt) withReferPrompt += 1;

      if (figureRef && hasReferPrompt && figureRef !== expectedFromPrompt) {
        issues.push(
          `${where}: figure_reference '${figureRef}' does not match prompt '${expectedFromPrompt}'.`
        );
      }

      if (hasReferPrompt && !figureRef) {
        issues.push(
          `${where}: question prompt references '${expectedFromPrompt}' but figure_reference is missing.`
        );
      }

      if (figureRef || hasReferPrompt || (typeof q.image_ref === "string" && q.image_ref.trim())) {
        const usable = hasUsableVisualContext(q, figureRef || expectedFromPrompt);
        if (usable) {
          withUsableVisualContext += 1;
        } else {
          issues.push(
            `${where}: missing visual context (no valid image_ref asset, no local figure image, and no figure_text).`
          );
        }

        // Provenance metadata is required for all figure-context questions.
        if (typeof q.source_pdf !== "string" || q.source_pdf.trim().length === 0) {
          issues.push(`${where}: missing required provenance field source_pdf.`);
        }
        if (typeof q.source_figure !== "string" || q.source_figure.trim().length === 0) {
          issues.push(`${where}: missing required provenance field source_figure.`);
        } else {
          const normalizedSourceFigure = normalizeFigureRef(q.source_figure);
          const expectedFigure = figureRef || expectedFromPrompt;
          if (expectedFigure && normalizedSourceFigure !== expectedFigure) {
            issues.push(
              `${where}: source_figure '${q.source_figure}' does not match expected '${expectedFigure}'.`
            );
          }
        }
        if (
          !(
            q.source_page === null ||
            (typeof q.source_page === "number" && Number.isFinite(q.source_page) && q.source_page > 0)
          )
        ) {
          issues.push(
            `${where}: source_page must be a positive number or null.`
          );
        }
        if (typeof q.source_locator !== "string" || q.source_locator.trim().length === 0) {
          issues.push(`${where}: missing required provenance field source_locator.`);
        }
      }

      if (typeof q.image_ref === "string" && q.image_ref.trim()) {
        const imagePath = resolveRelativePublicAsset(q.image_ref);
        if (!imagePath || !fs.existsSync(imagePath)) {
          issues.push(
            `${where}: image_ref '${q.image_ref}' does not exist under apps/web/public.`
          );
        }
      }

      if (figureRef && typeof q.citation === "string") {
        const citationFigure = q.citation.match(FIGURE_REF_FROM_TEXT);
        if (citationFigure) {
          const citationRef = `figure-${citationFigure[1]}`;
          if (citationRef !== figureRef) {
            issues.push(
              `${where}: citation references '${citationRef}' but figure_reference is '${figureRef}'.`
            );
          }
        }
      }
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    total,
    withFigureRef,
    withReferPrompt,
    withUsableVisualContext,
    issues,
  };
}

function writeReport(summary) {
  const lines = [
    "# Figure Context Audit",
    "",
    `- Generated: ${summary.generatedAt}`,
    `- Total questions audited: **${summary.total}**`,
    `- Questions with \`figure_reference\`: **${summary.withFigureRef}**`,
    `- Questions with \`(Refer to ... Figure N)\` prompt: **${summary.withReferPrompt}**`,
    `- Questions with usable visual context: **${summary.withUsableVisualContext}**`,
    `- Issues found: **${summary.issues.length}**`,
    "",
    "## Rules enforced",
    "- If prompt includes `Refer to ... Figure N`, `figure_reference` must exist and match.",
    "- Figure-based questions must provide at least one visual context path:",
    "  - valid `image_ref` file in `apps/web/public`, or",
    "  - local `public/figures/<figure_reference>.png`, or",
    "  - non-empty `figure_text` fallback.",
    "- If `image_ref` is present, file must exist.",
    "- If citation names a figure, it must match `figure_reference`.",
    "- Figure-context questions must include provenance metadata:",
    "  - `source_pdf` (non-empty string)",
    "  - `source_figure` (must match resolved figure)",
    "  - `source_page` (positive number or `null` when unknown).",
    "  - `source_locator` (non-empty string, e.g., `Figure 20, area 3`).",
    "",
    "## Issues",
  ];

  if (summary.issues.length === 0) {
    lines.push("- None.");
  } else {
    summary.issues.forEach((issue) => lines.push(`- ${issue}`));
  }

  lines.push("");
  fs.writeFileSync(REPORT_PATH, lines.join("\n"));
}

function main() {
  const summary = auditQuestions();
  writeReport(summary);

  if (summary.issues.length > 0) {
    console.error(
      `Figure/context audit failed with ${summary.issues.length} issue(s). See ${REPORT_PATH}`
    );
    process.exit(1);
  }

  console.log(
    `Figure/context audit passed. Audited ${summary.total} questions. Report: ${REPORT_PATH}`
  );
}

main();
