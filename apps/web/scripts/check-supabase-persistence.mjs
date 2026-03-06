#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();
const envFiles = [path.join(cwd, ".env.local"), path.join(cwd, ".env")];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

for (const file of envFiles) {
  loadEnvFile(file);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tableUserState = process.env.SUPABASE_TABLE_USER_STATE ?? "part107_user_state";
const tableLearningEvents =
  process.env.SUPABASE_TABLE_LEARNING_EVENTS ?? "part107_learning_events";
const tableQuestionIssues =
  process.env.SUPABASE_TABLE_QUESTION_ISSUES ?? "part107_question_issues";
const tableMagicLinkNonces =
  process.env.SUPABASE_TABLE_MAGIC_LINK_NONCES ?? "part107_magic_link_nonces";

if (!url) {
  console.error("FAIL: missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("FAIL: missing SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Add it to apps/web/.env.local, then rerun npm --prefix apps/web run supabase:check.");
  process.exit(1);
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function checkTable(tableName) {
  const { error } = await client.from(tableName).select("*", { head: true, count: "exact" });
  if (error) {
    throw new Error(`${tableName}: ${error.message}`);
  }
}

async function run() {
  console.log("Checking Supabase persistence tables...");
  console.log(`- URL: ${url}`);
  console.log(`- Table(user_state): ${tableUserState}`);
  console.log(`- Table(learning_events): ${tableLearningEvents}`);
  console.log(`- Table(question_issues): ${tableQuestionIssues}`);
  console.log(`- Table(magic_link_nonces): ${tableMagicLinkNonces}`);

  await checkTable(tableUserState);
  await checkTable(tableLearningEvents);
  await checkTable(tableQuestionIssues);
  await checkTable(tableMagicLinkNonces);

  console.log("PASS: Supabase persistence is reachable and tables are queryable.");
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: ${message}`);
  console.error(
    "If tables are missing, run docs/engineering/supabase_persistence_schema.sql in Supabase SQL editor."
  );
  process.exit(1);
});
