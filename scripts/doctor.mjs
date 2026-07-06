#!/usr/bin/env node
// doctor.mjs — runs inventory + validation + summary.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const start = Date.now();

function run(file) {
  const r = spawnSync("node", [join(SCRIPTS, file)], { encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const inv = run("inventory.mjs");
const val = run("validate-structure.mjs");

console.log("== Aegis Doctor ==\n");
console.log("--- Inventory ---");
console.log(inv.stdout);
console.log("--- Validation ---");
console.log(val.stdout || val.stderr);

const elapsedMs = Date.now() - start;
console.log(`\nTotal: ${elapsedMs}ms`);

process.exit(val.code === 0 && inv.code === 0 ? 0 : 1);
