#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0] || "0", 10);

if (!Number.isFinite(major)) {
  process.exit(0);
}

if (major >= 22) {
  console.error(
    [
      "",
      `Detected Node.js ${process.versions.node}.`,
      "This repo is validated on Node.js 20 LTS for stable Next.js 14 dev startup.",
      "Switch to Node 20 and run `npm run dev` again.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

