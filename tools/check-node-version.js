#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0] || "0", 10);

if (!Number.isFinite(major)) {
  process.exit(0);
}

if (major < 20 || major >= 25) {
  console.error(
    [
      "",
      `Detected Node.js ${process.versions.node}.`,
      "This repo supports Node.js 20.x, 22.x, and 24.x.",
      "Switch to Node 20, 22, or 24 and run `npm run dev` again.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

if (major !== 20 && major !== 22 && major !== 24) {
  console.warn(
    `Detected Node.js ${process.versions.node}. Use an even-numbered LTS Node release for local development.`
  );
}
