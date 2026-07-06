#!/usr/bin/env node
// test-projection.mjs — dependency-free projection + permissions test runner.
//
// Covers:
//   F2 — x-claude / x-opencode extraction. Asserts the ALREADY-COMMITTED Claude
//        and OpenCode projections: Claude flattens x-claude.* (agent:, paths:) and
//        carries NO x-claude/x-opencode blocks; OpenCode agents carry no x-claude.
//   E1 — permissions golden output. Asserts adapters/claude/agents/*.md tools:
//        match manifest/permissions.json, and that importing .opencode/plugins/
//        aegis.js and calling .config({}) yields the expected per-agent + global
//        permission shape.
//
// Run: node scripts/test-projection.mjs  (exit 1 on any failure)
// Node 20+ stdlib only.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function read(rel) {
  return readFileSync(join(REPO, rel), "utf8");
}

// Parse a `tools: [a, b, c]` frontmatter line into an array.
function parseFrontmatterBlock(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  return m ? m[1] : "";
}
function toolsArray(content) {
  const fm = parseFrontmatterBlock(content);
  const line = fm.split("\n").find((l) => /^tools:\s*\[/.test(l));
  if (!line) return null;
  return line
    .replace(/^tools:\s*\[/, "")
    .replace(/\]\s*$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── F2: x-claude / x-opencode extraction (committed-output assertions) ────────

test("F2: Claude code-review skill flattens x-claude.agent and drops x-blocks", () => {
  const c = read("adapters/claude/skills/core/code-review/SKILL.md");
  const fm = parseFrontmatterBlock(c);
  assert.match(fm, /^agent:\s*code-reviewer\s*$/m, "expected flattened `agent: code-reviewer`");
  assert.ok(!/x-claude/.test(fm), "Claude skill frontmatter must not carry x-claude");
  assert.ok(!/x-opencode/.test(fm), "Claude skill frontmatter must not carry x-opencode");
});

test("F2: Claude python-developer skill flattens x-claude.paths and drops x-blocks", () => {
  const c = read("adapters/claude/skills/languages/python-developer/SKILL.md");
  const fm = parseFrontmatterBlock(c);
  assert.match(fm, /^paths:\s*\[/m, "expected flattened `paths:` sequence");
  assert.match(fm, /\*\*\/\*\.py/, "expected the python glob to survive flattening");
  assert.ok(!/x-claude/.test(fm), "Claude skill frontmatter must not carry x-claude");
  assert.ok(!/x-opencode/.test(fm), "Claude skill frontmatter must not carry x-opencode");
});

test("F2: every committed OpenCode agent drops x-claude / x-opencode blocks", () => {
  const dir = join(REPO, ".opencode", "agents");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0, "expected .opencode/agents/*.md to exist");
  for (const f of files) {
    const fm = parseFrontmatterBlock(readFileSync(join(dir, f), "utf8"));
    assert.ok(!/x-claude/.test(fm), `${f}: OpenCode agent must not carry x-claude`);
    assert.ok(!/x-opencode/.test(fm), `${f}: OpenCode agent must not carry x-opencode`);
  }
});

// ── E1: permissions golden output ─────────────────────────────────────────────

test("E1: code-reviewer agent tools === [Read, Grep, Glob]", () => {
  const tools = toolsArray(read("adapters/claude/agents/code-reviewer.md"));
  assert.deepEqual(tools, ["Read", "Grep", "Glob"]);
});

test("E1: ultra-worker agent tools include Bash + Task + WebFetch", () => {
  const tools = toolsArray(read("adapters/claude/agents/ultra-worker.md"));
  assert.ok(tools, "ultra-worker must declare a tools: allowlist");
  for (const t of ["Bash", "Task", "WebFetch"]) {
    assert.ok(tools.includes(t), `ultra-worker tools must include ${t}`);
  }
});

test("E1: opencode plugin config() applies per-agent + global permissions", async () => {
  const permissions = JSON.parse(read("manifest/permissions.json"));
  const mod = await import(join(REPO, ".opencode", "plugins", "aegis.js"));
  const plugin = await mod.AegisPlugin();
  const cfg = {};
  await plugin.config(cfg);

  // Per-agent permission deep-equals manifest opencode block.
  const expected = permissions.agents["code-reviewer"].opencode;
  assert.deepEqual(
    cfg.agent["aegis-code-reviewer"].permission,
    expected,
    "aegis-code-reviewer.permission must deep-equal permissions.agents['code-reviewer'].opencode",
  );

  // Global cross-cutting deny: secrets glob denied.
  assert.equal(
    cfg.permission.read["**/secrets/**"],
    "deny",
    "global permission.read['**/secrets/**'] must be 'deny'",
  );
});

// ── AG-0256: Claude skills declared as bucket roots (one-level scan) ─────────
test("AG-0256: plugin.json skills lists bucket roots, not per-skill dirs", () => {
  const p = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.ok(Array.isArray(p.skills), "plugin.json skills must be an array");
  // Every entry is a bucket root: ./adapters/claude/skills/<scope>/ (2 path
  // segments under skills/, trailing slash). A per-skill dir would have 3.
  for (const s of p.skills) {
    assert.match(
      s,
      /^\.\/adapters\/claude\/skills\/[^/]+\/$/,
      `skills entry "${s}" must be a bucket root (…/skills/<scope>/), not a per-skill dir — Claude scans each entry one level deep for <name>/SKILL.md`,
    );
  }
  // Small set (buckets), not the full ~82 skill dirs.
  assert.ok(p.skills.length <= 10, `expected a few bucket roots, got ${p.skills.length}`);
});

// ── AG-0257: commands projected to a Claude-native tree + declared ──────────
test("AG-0257: plugin.json commands lists generated Claude command files", () => {
  const p = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.ok(Array.isArray(p.commands) && p.commands.length > 0, "plugin.json commands must be a non-empty array");
  for (const c of p.commands) {
    assert.match(c, /^\.\/adapters\/claude\/commands\/[^/]+\.md$/, `commands entry "${c}" must be a generated Claude command file path`);
  }
});
test("AG-0257: generated command frontmatter is Claude-native (no kind/x-claude/name)", () => {
  const c = read("adapters/claude/commands/statusline.md");
  const fm = c.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.match(fm, /^description:/m, "expected a description");
  assert.match(fm, /^argument-hint:/m, "expected argument-hint promoted from x-claude");
  // Must emit as a QUOTED string, not a bare `[preset]` (which YAML reads as an
  // array). Regression guard for the quoteIfNeeded flow-sequence exemption (M2).
  assert.match(fm, /^argument-hint:\s*['"].*['"]\s*$/m, "argument-hint must be a quoted string, not an unquoted flow sequence");
  assert.ok(!/^kind:/m.test(fm), "must not carry canonical `kind:`");
  assert.ok(!/x-claude/.test(fm), "must not carry x-claude block");
  assert.ok(!/^platforms:/m.test(fm), "must not carry canonical `platforms:`");
});

// ── AG-0255: per-host marketplace source shapes (no cross-host leak) ─────────
test("AG-0255: Claude marketplace uses a string source; Codex uses an object", () => {
  const claude = JSON.parse(read(".claude-plugin/marketplace.json"));
  const claudeSrc = claude?.plugins?.[0]?.source;
  assert.equal(typeof claudeSrc, "string", ".claude-plugin/marketplace.json source must be a string (Claude rejects the object form)");
  assert.ok(!String(claudeSrc).includes(".."), "Claude marketplace source must not escape the root");

  const codex = JSON.parse(read(".agents/plugins/marketplace.json"));
  const codexSrc = codex?.plugins?.[0]?.source;
  assert.equal(typeof codexSrc, "object", ".agents/plugins/marketplace.json source must be an object {source, path} (Codex form)");
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
