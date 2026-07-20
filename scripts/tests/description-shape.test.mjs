#!/usr/bin/env node
// description-shape.test.mjs — unit tests for the DESCRIPTION_SHAPE validator
// (v0.1.2).
//
// Dependency-free, TAP-ish (matches scripts/test-projection.mjs style). Builds
// a minimal ctx stub mirroring the scripts/validate/_context.mjs surface the
// rule uses (files/rel/read/fmSplit) over throwaway temp-dir fixtures — no real
// repo state is touched. Run: node scripts/tests/description-shape.test.mjs
// (exit 1 on any failure). Node 20+ stdlib only.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { run as runDescriptionShape } from "../validate/description-shape.mjs";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Minimal ctx shim mirroring validate/_context.mjs (REPO, files, rel, read,
// fmSplit) — same shape trigger-phrase.mjs's rule consumes. No tree walk
// needed; the fixture file list is built directly.
function fmSplit(text) {
  if (!text.startsWith("---\n")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { fm: null, body: text };
  return { fm: text.slice(4, end), body: text.slice(end + 4) };
}

function makeCtx(REPO, files) {
  const rel = (p) => relative(REPO, p);
  const read = (p) => readFileSync(p, "utf8");
  return { REPO, files, rel, read, fmSplit };
}

function writeSkill(REPO, name, description) {
  const dir = join(REPO, "skills", "core", name);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "SKILL.md");
  writeFileSync(
    p,
    `---\nname: ${name}\ndescription: ${description}\nvisibility: user\nplatforms: [claude]\n---\n\n# ${name}\n`,
  );
  return p;
}

// ── BAD fixture: arrow + conjugated verb → one warning ─────────────────────

test("BAD fixture (arrow) produces exactly one DESCRIPTION_SHAPE warning", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-desc-shape-test-"));
  try {
    const p = writeSkill(REPO, "bad-arrow", "Use when X — emits Y → Z.");
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runDescriptionShape(ctx);
    assert.equal(errors.length, 0, "rule must never push to errors");
    assert.equal(warnings.length, 1, "expected exactly one warning");
    assert.match(warnings[0], /DESCRIPTION_SHAPE/);
    assert.match(warnings[0], /bad-arrow/);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

test("BAD fixture (conjugated verb only) produces exactly one warning", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-desc-shape-test-"));
  try {
    const p = writeSkill(REPO, "bad-verb", "Use when reviewing a diff — orchestrates the review.");
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runDescriptionShape(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /orchestrates/);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: pure "Use when…" trigger → zero warnings ─────────────────

test("GOOD fixture (pure trigger) produces zero warnings", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-desc-shape-test-"));
  try {
    const p = writeSkill(REPO, "good-trigger", "Use when X.");
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runDescriptionShape(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0);
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: em-dash gloss shape (house style) → zero warnings ────────

test("GOOD fixture (em-dash gloss, house style) does NOT trip the rule", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-desc-shape-test-"));
  try {
    const p = writeSkill(
      REPO,
      "good-emdash",
      "Use when reviewing diffs — severity-graded findings with a fail-closed verdict.",
    );
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runDescriptionShape(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "em-dash gloss shape is house style, not a mechanism marker");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── GOOD fixture: `dispatch` noun (not the conjugated verb) → zero warnings ─

test("GOOD fixture (dispatch noun, not conjugated verb) does NOT trip the rule", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-desc-shape-test-"));
  try {
    const p = writeSkill(REPO, "good-dispatch-noun", "Use when 2+ independent failures need parallel agent dispatch.");
    const ctx = makeCtx(REPO, [p]);
    const { errors, warnings } = runDescriptionShape(ctx);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0, "the noun 'dispatch' must not match the conjugated 'dispatches ' verb marker");
  } finally {
    rmSync(REPO, { recursive: true, force: true });
  }
});

// ── Self-consistency: the rule NEVER pushes to errors ───────────────────────

test("rule never pushes to errors, regardless of input", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-desc-shape-test-"));
  try {
    const p = writeSkill(REPO, "bad-both", "Use when X — runs Y, emits Z, orchestrates W, dispatches V -> done.");
    const ctx = makeCtx(REPO, [p]);
    const { errors } = runDescriptionShape(ctx);
    assert.equal(errors.length, 0, "DESCRIPTION_SHAPE is warn-only and must never emit an error");
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
