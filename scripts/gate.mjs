#!/usr/bin/env node
// gate.mjs — one-shot ready-to-push check. Runs structure + counts validation,
// projection/deny-hook/unit tests, doctor, and the five security scanners in
// sequence. Prints PASS/FAIL per step; exits 1 if any step fails. This is the
// single entry point CI runs (`npm run gate`) and the local pre-push check.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPTS);

const nodeSteps = [
  "validate-structure.mjs",
  "validate-counts.mjs",
  "test-projection.mjs",
  "test-deny-hook.mjs",
  "doctor.mjs",
];
const unitTests = readdirSync(join(SCRIPTS, "tests"))
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => join("tests", f));
const scans = [
  "secret-scan.sh",
  "base64-scan.sh",
  "prompt-injection-scan.sh",
  "unicode-safety-scan.sh",
  "personal-paths-scan.sh",
];

const steps = [
  ...nodeSteps.map((f) => ["node", [join(SCRIPTS, f)], f]),
  ...unitTests.map((f) => ["node", [join(SCRIPTS, f)], f]),
  ...scans.map((f) => ["bash", [join(SCRIPTS, f)], f]),
];

let failed = 0;
for (const [cmd, argv, label] of steps) {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
  if (r.status === 0) {
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}`);
    if (r.stderr?.length) console.log(String(r.stderr).trimEnd());
  }
}

const total = steps.length;
console.log(`\nGATE: ${total - failed} passed, ${failed} failed (of ${total})`);
process.exit(failed ? 1 : 0);
