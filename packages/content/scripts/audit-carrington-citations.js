#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CARRINGTON_PATH = path.join(REPO_ROOT, "docs/ssot/review/carrington_question_bank.json");
const REPORT_PATH = path.join(REPO_ROOT, "docs/ssot/review/CarringtonCitationGate.md");

const EXPLICIT_FAA_CITATION = /\b(14\s*CFR\s*(?:Part|§)?\s*\d+(?:\.\d+)?|FAA-CT-8080-2H|UA\.[IVX]+\.[A-Z]\.K\d+[A-Z]?|AIM\s*\d+-\d+(?:-\d+)?|AC\s*\d+-\d+)\b/i;

function loadRows() {
  if (!fs.existsSync(CARRINGTON_PATH)) return [];
  return JSON.parse(fs.readFileSync(CARRINGTON_PATH, "utf8"));
}

function hasExplicitCitation(row) {
  const citation = String(row.faa_citation ?? row.reference ?? "").trim();
  return EXPLICIT_FAA_CITATION.test(citation);
}

function main() {
  const rows = loadRows();
  const flagged = [];
  let eligibleCount = 0;
  let mappedCount = 0;

  for (const row of rows) {
    const eligible = row.confirmed_test_eligible === true;
    if (!eligible) continue;
    eligibleCount += 1;
    const mapped = hasExplicitCitation(row);
    if (mapped) mappedCount += 1;
    if (!mapped) {
      flagged.push({
        id: row.id,
        question: String(row.question || "").trim(),
        reference: String(row.reference || "").trim(),
        faa_citation: row.faa_citation ?? null,
      });
    }
  }

  const lines = [];
  lines.push("# Carrington Citation Gate");
  lines.push("");
  lines.push(`- Source: \`${CARRINGTON_PATH}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Total rows: **${rows.length}**`);
  lines.push(`- Marked confirmed-test eligible: **${eligibleCount}**`);
  lines.push(`- Eligible rows with explicit FAA citation mapping: **${mappedCount}**`);
  lines.push(`- Eligible rows missing citation mapping (blocked): **${flagged.length}**`);
  lines.push("");
  lines.push("## Rule");
  lines.push("- Any Carrington row with `confirmed_test_eligible: true` must include explicit FAA citation mapping in `faa_citation` or `reference` (e.g., `14 CFR §107.41`, `FAA-CT-8080-2H`, `UA.I.B.K16`).");
  lines.push("");
  lines.push("## Blocked Rows");
  if (flagged.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| ID | Reference | FAA Citation | Question |");
    lines.push("|---|---|---|---|");
    for (const row of flagged.slice(0, 200)) {
      const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
      lines.push(`| ${esc(row.id)} | ${esc(row.reference)} | ${esc(row.faa_citation ?? "")} | ${esc(row.question)} |`);
    }
  }
  lines.push("");

  fs.writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`);
  console.log(`Carrington citation gate report: ${REPORT_PATH}`);

  if (flagged.length > 0) {
    console.error(
      `Carrington citation gate failed: ${flagged.length} confirmed-test-eligible row(s) missing explicit FAA citation mapping.`
    );
    process.exit(1);
  }
}

main();
