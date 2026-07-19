#!/usr/bin/env node
// subagent-primitives-projection.test.mjs — unit tests for x-claude native subagent
// execution-profile fields (effort/isolation/maxTurns/background) projection.
//
// Dependency-free, TAP-ish (matches scripts/test-projection.mjs style).
// Assertions:
//   P1 — code-simplifier Claude generated frontmatter carries isolation: worktree.
//   P2 — code-reviewer Claude generated frontmatter carries effort: high.
//   P3 — code-architect Claude generated frontmatter carries effort: high.
//   P4 — the OpenCode + Codex copies of all three agents carry neither field.
//   P5 — the REAL validateSubagentPrimitive() (scripts/lib/subagent-primitives.mjs)
//        accepts parser-typed (string) valid values and coerces maxTurns/background;
//        hard-fails on invalid values.
//   P6 — assertIsolationWritable() passes for a write-capable agent, throws for a
//        read-only one.
//
// Run: node scripts/tests/subagent-primitives-projection.test.mjs  (exit 1 on any failure)
// Node 20+ stdlib only.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { validateSubagentPrimitive, assertIsolationWritable } from "../lib/subagent-primitives.mjs";

const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── Helpers ──────────────────────────────────────────────────────────────────

function read(rel) {
  return readFileSync(join(REPO, rel), "utf8");
}

function parseFrontmatterBlock(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  return m ? m[1] : "";
}

// ── P1: code-simplifier Claude generated frontmatter carries isolation: worktree ──

test("P1: code-simplifier Claude generated frontmatter carries isolation: worktree", () => {
  const c = read("adapters/claude/agents/code-simplifier.md");
  const fm = parseFrontmatterBlock(c);
  assert.match(
    fm,
    /^isolation:\s*worktree\s*$/m,
    "generated Claude agent frontmatter must carry `isolation: worktree`",
  );
});

// ── P2: code-reviewer Claude generated frontmatter carries effort: high ───────────

test("P2: code-reviewer Claude generated frontmatter carries effort: high", () => {
  const c = read("adapters/claude/agents/code-reviewer.md");
  const fm = parseFrontmatterBlock(c);
  assert.match(
    fm,
    /^effort:\s*high\s*$/m,
    "generated Claude agent frontmatter must carry `effort: high`",
  );
});

// ── P3: code-architect Claude generated frontmatter carries effort: high ─────────

test("P3: code-architect Claude generated frontmatter carries effort: high", () => {
  const c = read("adapters/claude/agents/code-architect.md");
  const fm = parseFrontmatterBlock(c);
  assert.match(
    fm,
    /^effort:\s*high\s*$/m,
    "generated Claude agent frontmatter must carry `effort: high`",
  );
});

// ── P4: OpenCode + Codex copies carry neither field ───────────────────────────────

test("P4: OpenCode generated copies do NOT contain effort:/isolation:", () => {
  for (const name of ["code-simplifier", "code-reviewer", "code-architect"]) {
    const c = read(`.opencode/agents/${name}.md`);
    const fm = parseFrontmatterBlock(c);
    assert.ok(
      !/^effort:/m.test(fm) && !/^isolation:/m.test(fm),
      `OpenCode agent frontmatter for ${name} must NOT carry effort:/isolation: fields`,
    );
    // Also assert the body doesn't accidentally inject either as prose.
    assert.ok(
      !/^effort:\s/m.test(c) && !/^isolation:\s/m.test(c),
      `OpenCode agent file for ${name} must not contain a bare effort:/isolation: line anywhere`,
    );
  }
});

test("P4: Codex generated copies do NOT contain effort:/isolation:", () => {
  const paths = {
    "code-simplifier": ".codex/plugins/aegis/skills/aegis-code-simplifier/SKILL.md",
    "code-reviewer": ".codex/plugins/aegis/skills/aegis-code-reviewer/SKILL.md",
    "code-architect": ".codex/plugins/aegis/skills/aegis-code-architect/SKILL.md",
  };
  for (const [name, rel] of Object.entries(paths)) {
    const c = read(rel);
    assert.ok(
      !/^effort:/m.test(c) && !/^isolation:/m.test(c),
      `Codex skill SKILL.md for ${name} must not contain effort:/isolation: fields`,
    );
  }
});

// ── P5: real validateSubagentPrimitive() — parser-typed (string) inputs ────────

test("P5: validateSubagentPrimitive() accepts valid parser-typed values (coercing maxTurns/background)", () => {
  // parseFrontmatter() in project.mjs stores nested x-claude scalars as STRINGS
  // (no coercion) — "maxTurns: 10" arrives as "10", "background: true" arrives
  // as "true". These assertions exercise the REAL exported function against
  // those string inputs (the bug this fixes: the old inline guards hard-failed
  // on valid string values because they never coerced first).
  assert.equal(validateSubagentPrimitive("effort", "high"), "high");
  assert.equal(validateSubagentPrimitive("isolation", "worktree"), "worktree");
  assert.equal(validateSubagentPrimitive("maxTurns", "10"), 10);
  assert.equal(validateSubagentPrimitive("maxTurns", 10), 10);
  assert.equal(validateSubagentPrimitive("background", "true"), true);
  assert.equal(validateSubagentPrimitive("background", "false"), false);
  assert.equal(validateSubagentPrimitive("background", true), true);
});

test("P5: validateSubagentPrimitive() throws on invalid values", () => {
  assert.throws(
    () => validateSubagentPrimitive("effort", "ultra"),
    /x-claude\.effort .* is invalid/,
  );
  assert.throws(
    () => validateSubagentPrimitive("isolation", "sandbox"),
    /x-claude\.isolation .* is invalid/,
  );
  for (const v of ["0", "-1", "abc", "1.5"]) {
    assert.throws(
      () => validateSubagentPrimitive("maxTurns", v),
      /x-claude\.maxTurns .* is invalid/,
      `invalid maxTurns '${v}' must throw`,
    );
  }
  for (const v of ["yes", "1"]) {
    assert.throws(
      () => validateSubagentPrimitive("background", v),
      /x-claude\.background .* is invalid/,
      `invalid background '${v}' must throw`,
    );
  }
});

// ── P6: assertIsolationWritable() ───────────────────────────────────────────────

test("P6: assertIsolationWritable() passes for a write-capable agent, throws for a read-only one", () => {
  assert.doesNotThrow(() =>
    assertIsolationWritable("code-simplifier", ["Read", "Edit", "Grep", "Glob"]),
  );
  assert.throws(
    () => assertIsolationWritable("code-reviewer", ["Read", "Grep", "Glob"]),
    /isolation: worktree requires Edit or Write/,
  );
});

// ── Runner ─────────────────────────────────────────────────────────────────--
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
