#!/usr/bin/env node
// three-arm-baseline.mjs — static-lint arm, live (v0.1.2).
//
// Loads every fixture under ./fixtures/*.json and, per fixture, asserts:
//   (a) required fields are present (id, prompt, expectRoutesTo, criterion), and
//   (b) EACH path in expectRoutesTo exists in the repo AND is a skill folder
//       (carries a SKILL.md) — so a future rename of a routed-to skill fails
//       this harness instead of silently drifting.
//
// This is the "Static lint arm" described in scripts/eval/README.md. It is
// dependency-free, makes no API/network calls, and gives real regression
// value: renaming `default-feature` or `brainstorm-spec` now fails the
// harness. The LLM-Judge and Monte-Carlo arms remain deferred (no API keys,
// no cost, per the v0.0.6 "Honest Gaps" decision — unchanged in v0.1.2).
//
// Run: node scripts/eval/three-arm-baseline.mjs   (exit 1 on any failure)
// Node 20+ stdlib only.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const FIXTURES_DIR = join(REPO, "scripts", "eval", "fixtures");

const REQUIRED_FIELDS = ["id", "prompt", "expectRoutesTo", "criterion"];

function loadFixtures() {
  const names = readdirSync(FIXTURES_DIR).filter((n) => n.endsWith(".json"));
  return names.map((n) => {
    const p = join(FIXTURES_DIR, n);
    const data = JSON.parse(readFileSync(p, "utf8"));
    return { file: n, data };
  });
}

// A routed-to path is a skill folder that exists AND carries a SKILL.md — the
// same shape a rename would break, giving real regression value.
function skillPathExists(rel) {
  const abs = join(REPO, rel);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return false;
  return existsSync(join(abs, "SKILL.md"));
}

function checkFixture({ file, data }) {
  const failures = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) failures.push(`missing required field "${field}"`);
  }

  if (Array.isArray(data.expectRoutesTo)) {
    if (data.expectRoutesTo.length === 0) {
      failures.push('"expectRoutesTo" must be a non-empty array');
    }
    for (const rel of data.expectRoutesTo) {
      if (!skillPathExists(rel)) {
        failures.push(`expectRoutesTo path does not resolve to a skill: "${rel}"`);
      }
    }
  } else if ("expectRoutesTo" in data) {
    failures.push('"expectRoutesTo" must be an array');
  }

  return failures;
}

function main() {
  const fixtures = loadFixtures();
  let failed = 0;

  if (fixtures.length === 0) {
    console.error("eval: no fixtures found under scripts/eval/fixtures/*.json");
    process.exit(1);
  }

  for (const fx of fixtures) {
    const failures = checkFixture(fx);
    const id = fx.data.id ?? fx.file;
    if (failures.length === 0) {
      console.log(`PASS  ${id} (${fx.file})`);
    } else {
      failed++;
      console.log(`FAIL  ${id} (${fx.file})`);
      for (const f of failures) console.log(`      - ${f}`);
    }
  }

  console.log("");
  console.log(
    `# static-lint arm: ${fixtures.length - failed} passed, ${failed} failed (of ${fixtures.length})`,
  );

  if (failed > 0) process.exit(1);
  process.exit(0);
}

main();
