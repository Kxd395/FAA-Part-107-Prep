#!/usr/bin/env node

function parseArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value ?? fallback;
}

const baseUrl = parseArg("--url", process.env.PERF_BASE_URL || "http://localhost:3000");
const requests = Math.max(1, Number.parseInt(parseArg("--requests", "40"), 10) || 40);
const concurrency = Math.max(1, Number.parseInt(parseArg("--concurrency", "5"), 10) || 5);
const p95BudgetMs = Math.max(1, Number.parseInt(parseArg("--p95-budget-ms", "800"), 10) || 800);
const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/questions?shuffle=1&limit=60`;

async function run() {
  const durations = [];
  let succeeded = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < requests) {
      const idx = cursor;
      cursor += 1;

      const started = Date.now();
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const duration = Date.now() - started;
        durations[idx] = duration;
        if (response.ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
      } catch {
        durations[idx] = Date.now() - started;
        failed += 1;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, requests) }, () => worker());
  await Promise.all(workers);

  const sorted = durations.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const avg =
    sorted.length > 0 ? Number((sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(2)) : 0;

  console.log(`Perf smoke target: ${endpoint}`);
  console.log(`Requests: ${requests}, Concurrency: ${concurrency}`);
  console.log(`Success: ${succeeded}, Failed: ${failed}`);
  console.log(`Latency ms -> p50: ${p50}, p95: ${p95}, avg: ${avg}, max: ${max}`);

  if (failed > 0) {
    console.error(`Perf smoke failed: ${failed} request(s) were non-2xx or errored.`);
    process.exit(1);
  }
  if (p95 > p95BudgetMs) {
    console.error(`Perf smoke failed: p95 ${p95}ms exceeds budget ${p95BudgetMs}ms.`);
    process.exit(1);
  }

  console.log("Perf smoke passed.");
}

run().catch((error) => {
  console.error("Perf smoke failed with an unexpected error.");
  console.error(error);
  process.exit(1);
});
