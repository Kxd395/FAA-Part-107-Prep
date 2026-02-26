#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SOURCE_DIR = path.join(
  REPO_ROOT,
  "source-materials/Remote Pilot – Small Unmanned Aircraft Systems Study Guide August 2016 FAA 107 images"
);
const TARGET_DIR = path.join(REPO_ROOT, "apps/web/public/figures/rpsg-2016");
const MANIFEST_JSON = path.join(REPO_ROOT, "docs/ssot/review/remote_pilot_2016_image_manifest.json");
const MANIFEST_MD = path.join(REPO_ROOT, "docs/ssot/review/RemotePilot2016ImageInventory.md");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFigureParts(fileName) {
  const noExt = fileName.replace(/\.[^.]+$/, "");
  const match = noExt.match(/figure\s*([0-9]+)-([0-9]+)/i);
  if (!match) return null;
  return {
    chapter: match[1],
    figure: match[2],
    figureKey: `figure-${match[1]}-${match[2]}`,
  };
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory missing: ${SOURCE_DIR}`);
    process.exit(1);
  }
  ensureDir(TARGET_DIR);
  ensureDir(path.dirname(MANIFEST_JSON));

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  const manifest = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const parsed = parseFigureParts(file);
    const noExt = file.replace(/\.[^.]+$/, "");
    const title = noExt.replace(/^Figure\s*[0-9]+-[0-9]+\.?\s*/i, "").trim();
    const key = parsed?.figureKey ?? slugify(noExt);
    const targetName = `rpsg2016-${key}${ext}`;

    const sourcePath = path.join(SOURCE_DIR, file);
    const targetPath = path.join(TARGET_DIR, targetName);
    fs.copyFileSync(sourcePath, targetPath);

    manifest.push({
      source_file: file,
      source_path: sourcePath,
      figure_key: parsed?.figureKey ?? null,
      chapter: parsed?.chapter ?? null,
      figure: parsed?.figure ?? null,
      title: title || null,
      public_url: `/figures/rpsg-2016/${targetName}`,
      public_file: targetPath,
    });
  }

  fs.writeFileSync(MANIFEST_JSON, `${JSON.stringify(manifest, null, 2)}\n`);

  const malformed = manifest.filter((row) => !row.figure_key);
  const lines = [];
  lines.push("# Remote Pilot 2016 Image Inventory");
  lines.push("");
  lines.push(`- Source folder: \`${SOURCE_DIR}\``);
  lines.push(`- Imported images: **${manifest.length}**`);
  lines.push(`- Imported to: \`${TARGET_DIR}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Files");
  lines.push("| Source | Figure Key | Public URL |");
  lines.push("|---|---|---|");
  for (const row of manifest) {
    const esc = (v) => String(v ?? "").replace(/\|/g, "\\|");
    lines.push(`| ${esc(row.source_file)} | ${esc(row.figure_key ?? "")} | ${esc(row.public_url)} |`);
  }
  lines.push("");
  lines.push("## Filename Issues");
  if (malformed.length === 0) {
    lines.push("- None");
  } else {
    for (const row of malformed) {
      lines.push(`- ${row.source_file}`);
    }
  }
  lines.push("");
  fs.writeFileSync(MANIFEST_MD, `${lines.join("\n")}\n`);

  console.log(
    `Imported ${manifest.length} images to ${TARGET_DIR}\nManifest: ${MANIFEST_JSON}\nReport: ${MANIFEST_MD}`
  );
}

main();
