#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0] || "0", 10);

if (!Number.isFinite(major)) {
  process.exit(0);
}

if (major < 20 || major >= 23) {
  console.error(
    [
      "",
      `Detected Node.js ${process.versions.node}.`,
      "This repo supports Node.js 20.x and 22.x.",
      "Switch to Node 20 or 22 and run `npm run dev` again.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

if (major !== 20) {
  console.warn(
    `Detected Node.js ${process.versions.node}. Node.js 20.x is the primary validated baseline for local development.`
  );
}
