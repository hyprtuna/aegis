#!/usr/bin/env node
// shipped-ref.test.mjs — unit tests for the SHIPPED_REF validator (v0.1.4).
//
// Dependency-free, TAP-ish (matches scripts/test-projection.mjs style). Builds
// a minimal ctx stub mirroring the scripts/validate/_context.mjs surface the
// rule uses (files/rel/read) over throwaway temp-dir fixtures — no real repo
// state is touched. The planted example strings below (an "AG-" ticket-shaped
// token and a "v0." pre-launch-shaped version token) are deliberately built by
// string concatenation rather than written as literal substrings, so this
// committed test file does not itself trip a real SHIPPED_REF scan of the
// repo (which additionally exempts the whole scripts/tests/ directory as a
// belt-and-braces second guard — see shipped-ref.mjs's isExempt()).
// Run: node scripts/tests/shipped-ref.test.mjs (exit 1 on any failure).
// Node 20+ stdlib only.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { run as runShippedRef } from "../validate/shipped-ref.mjs";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Planted example tokens, assembled so the source text of THIS file never
// contains the literal matchable substrings.
const PLANTED_AG_REF = "AG-" + "0999";
const PLANTED_VERSION_STAMP = "v0." + "3.99";
const CLEAN_PUBLIC_VERSION = "v0." + "1.5";
const LOWERCASE_AG_PATH_TOKEN = "ag-" + "0008";
const MJS_VERSION_COMMENT = "v0." + "0.5";

function makeCtx(REPO, files) {
  const rel = (p) => relative(REPO, p);
  const read = (p) => readFileSync(p, "utf8");
  return { REPO, files, rel, read };
}

function writeFile(REPO, relPath, content) {
  const p = join(REPO, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
}

// ── BAD fixture: planted AG-NNNN ticket ref, any extension → one warning ───

test("planted AG-NNNN ref in a .md file produces exactly one SHIPPED_REF warning", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "docs/example.md", `See ${PLANTED_AG_REF} for context.\n`);
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0, "rule must never push to errors");
    assert.equal(warnings.length, 1, "expected exactly one warning");
    assert.match(warnings[0], /SHIPPED_REF/);
    assert.match(warnings[0], /docs\/example\.md:1/);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

test("planted AG-NNNN ref fires in ANY scanned extension, not just .md", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "src/example.mjs", `// rationale: ${PLANTED_AG_REF} fixed this\n`);
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 1, "AG-NNNN check applies to all scanned files, not just .md");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── BAD fixture: pre-launch version stamp in .md → one warning ─────────────

test("planted pre-launch version stamp in a .md file produces exactly one warning", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "docs/history.md", `Added in ${PLANTED_VERSION_STAMP}.\n`);
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /docs\/history\.md:1/);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: pre-launch version stamp in a NON-.md file → zero ────────

test("pre-launch version stamp in a .mjs code comment does NOT fire (version check is .md-only)", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "src/example.mjs", `// added in ${MJS_VERSION_COMMENT}\nconst x = 1;\n`);
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "version-stamp check must be .md-only");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: current public v0.1.x series → zero ───────────────────────

test("current public v0.1.x version does NOT fire", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "docs/notes.md", `Shipped in ${CLEAN_PUBLIC_VERSION}.\n`);
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "v0.1.x is the current public series and must be exempt");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: host-version refs (v2.1.105) → zero ───────────────────────

test("host version references (e.g. v2.1.105) do NOT fire", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "docs/notes.md", "Requires Claude Code v2.1.105 or later.\n");
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: lowercase ag-NNNN path-citation form → zero ──────────────

test("lowercase ag-NNNN path-citation form does NOT fire (regex is uppercase AG- only)", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(
      REPO,
      "docs/notes.md",
      `See .aegis/specs/features/${LOWERCASE_AG_PATH_TOKEN}-example/decisions.md\n`,
    );
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "lowercase ag- path citations must not match the uppercase AG- regex");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: CHANGELOG.md is exempt ────────────────────────────────────

test("CHANGELOG.md is exempt from both checks", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(
      REPO,
      "CHANGELOG.md",
      `## Old entry\n- ${PLANTED_AG_REF} — ${PLANTED_VERSION_STAMP}\n`,
    );
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "CHANGELOG.md must be exempt (public history starts at v0.1.0)");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: scripts/tests/ is exempt ──────────────────────────────────

test("files under scripts/tests/ are exempt from both checks", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(
      REPO,
      "scripts/tests/some-other.test.mjs",
      `// planted fixture: ${PLANTED_AG_REF}\n`,
    );
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "scripts/tests/ legitimately plants example refs and must be exempt");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: clean file → zero ─────────────────────────────────────────

test("clean file produces zero warnings", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(REPO, "docs/clean.md", "Nothing to see here.\n");
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runShippedRef(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── Self-consistency: the rule NEVER pushes to errors ───────────────────────

test("rule never pushes to errors, regardless of input", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-shipped-ref-test-"));
  try {
    const p = writeFile(
      REPO,
      "docs/both.md",
      `${PLANTED_AG_REF} and ${PLANTED_VERSION_STAMP} together.\n`,
    );
    const ctx = makeCtx(REPO, [p]);
    const { errors } = runShippedRef(ctx);
    assert.equal(errors.length, 0, "SHIPPED_REF is warn-only and must never emit an error");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── Runner ───────────────────────────────────────────────────────────────────
const run = async () => {
  let passed = 0;
  let failed = 0;
  console.log(`TAP version 13`);
  console.log(`1..${tests.length}`);
  for (let i = 0; i < tests.length; i++) {
    const { name, fn } = tests[i];
    try {
      await fn();
      passed++;
      console.log(`ok ${i + 1} - ${name}`);
    } catch (err) {
      failed++;
      console.log(`not ok ${i + 1} - ${name}`);
      console.log(`  ---`);
      console.log(`  message: ${String(err && err.message).split("\n").join("\n    ")}`);
      console.log(`  ---`);
    }
  }
  console.log("");
  console.log(`# ${passed} passed, ${failed} failed (of ${tests.length})`);
  if (failed > 0) process.exit(1);
};

run();
