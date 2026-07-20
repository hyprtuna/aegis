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

// Recursively yield every file under `dir`. Missing dir → yields nothing.
function* walkFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(full);
    else if (e.isFile()) yield full;
  }
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

// x-claude.paths flattening, discovered from source rather than pinned to one skill.
//
// This used to assert against `python-developer`, one of four language overlays that
// carried `x-claude.paths`. Those overlays are now fragments under the `develop` skill,
// so the corpus currently carries ZERO `x-claude.paths` declarations and a test pinned to
// a named carrier would either fail or, worse, be quietly rewritten to assert nothing.
//
// So the test derives its subjects from canonical. When a skill declares `x-claude.paths`
// it must project a flattened `paths:` with its globs intact. When none does — today's
// state — the assertion inverts: no generated skill may carry a `paths:` key the canonical
// source never declared. Both directions fail loudly on a projector regression; neither
// passes vacuously, and the empty case is a stated fact rather than an accident.
function pathsCarryingSkills() {
  const out = [];
  for (const scope of ["core", "workflows"]) {
    const scopeDir = join(REPO, "skills", scope);
    let entries;
    try {
      entries = readdirSync(scopeDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      let text;
      try {
        text = readFileSync(join(scopeDir, entry, "SKILL.md"), "utf8");
      } catch {
        continue;
      }
      const fm = parseFrontmatterBlock(text);
      const m = /^\s+paths:\s*(\[.*\])\s*$/m.exec(fm);
      if (m) out.push({ rel: `adapters/claude/skills/${scope}/${entry}/SKILL.md`, globs: m[1] });
    }
  }
  return out;
}

test("F2: Claude skills flatten x-claude.paths and drop x-blocks", () => {
  const carriers = pathsCarryingSkills();

  for (const { rel, globs } of carriers) {
    const fm = parseFrontmatterBlock(read(rel));
    assert.match(fm, /^paths:\s*\[/m, `${rel}: expected flattened \`paths:\` sequence`);
    for (const glob of globs.matchAll(/"([^"]+)"/g)) {
      assert.ok(
        fm.includes(glob[1]),
        `${rel}: glob ${glob[1]} did not survive flattening`,
      );
    }
    assert.ok(!/x-claude/.test(fm), `${rel}: Claude skill frontmatter must not carry x-claude`);
    assert.ok(!/x-opencode/.test(fm), `${rel}: Claude skill frontmatter must not carry x-opencode`);
  }

  if (carriers.length === 0) {
    // No canonical carrier: assert the projector invents nothing.
    for (const scope of ["core", "workflows"]) {
      const genScope = join(REPO, "adapters/claude/skills", scope);
      let entries;
      try {
        entries = readdirSync(genScope);
      } catch {
        continue;
      }
      for (const entry of entries) {
        const rel = `adapters/claude/skills/${scope}/${entry}/SKILL.md`;
        let fm;
        try {
          fm = parseFrontmatterBlock(read(rel));
        } catch {
          continue;
        }
        assert.ok(
          !/^paths:/m.test(fm),
          `${rel}: generated a \`paths:\` key no canonical skill declares`,
        );
      }
    }
  }
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

// ── Claude skills declared as bucket roots (one-level scan) ─────────────────
test("plugin.json skills lists bucket roots, not per-skill dirs", () => {
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
  // Small set (buckets), not the full ~63 skill dirs.
  assert.ok(p.skills.length <= 10, `expected a few bucket roots, got ${p.skills.length}`);
});

// ── Commands projected to a Claude-native tree + declared ───────────────────
test("plugin.json commands lists generated Claude command files", () => {
  const p = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.ok(Array.isArray(p.commands) && p.commands.length > 0, "plugin.json commands must be a non-empty array");
  for (const c of p.commands) {
    assert.match(c, /^\.\/adapters\/claude\/commands\/[^/]+\.md$/, `commands entry "${c}" must be a generated Claude command file path`);
  }
});
test("generated command frontmatter is Claude-native (no kind/x-claude/name)", () => {
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

// ── Per-host marketplace source shapes (no cross-host leak) ─────────────────
test("Claude marketplace uses a string source; Codex uses an object", () => {
  const claude = JSON.parse(read(".claude-plugin/marketplace.json"));
  const claudeSrc = claude?.plugins?.[0]?.source;
  assert.equal(typeof claudeSrc, "string", ".claude-plugin/marketplace.json source must be a string (Claude rejects the object form)");
  assert.ok(!String(claudeSrc).includes(".."), "Claude marketplace source must not escape the root");

  const codex = JSON.parse(read(".agents/plugins/marketplace.json"));
  const codexSrc = codex?.plugins?.[0]?.source;
  assert.equal(typeof codexSrc, "object", ".agents/plugins/marketplace.json source must be an object {source, path} (Codex form)");
});

// ── V1–V3: visibility → native user-invocable (committed-output assertions) ───
// Canonical `visibility: internal` projects to Claude's native `user-invocable: false`,
// which hides a skill from the `/` menu while leaving model invocation and its
// description-in-context intact (claude-code-docs/docs/skills.md:250, :368).

// Canonical skills carrying `visibility: internal`, discovered from source so the
// test cannot silently pass by asserting an empty set.
function internalCanonicalSkills() {
  const out = [];
  for (const scope of ["core", "workflows"]) {
    const scopeDir = join(REPO, "skills", scope);
    let entries;
    try {
      entries = readdirSync(scopeDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      let text;
      try {
        text = readFileSync(join(scopeDir, entry, "SKILL.md"), "utf8");
      } catch {
        continue;
      }
      if (/^visibility:\s*internal\s*$/m.test(parseFrontmatterBlock(text))) {
        out.push(`adapters/claude/skills/${scope}/${entry}/SKILL.md`);
      }
    }
  }
  return out;
}

test("V1: every canonical internal skill projects user-invocable: false on Claude", () => {
  const internal = internalCanonicalSkills();
  assert.ok(
    internal.length > 0,
    "expected at least one canonical skill with `visibility: internal` — if the corpus " +
      "genuinely has none, this assertion must be removed deliberately, not left to pass vacuously",
  );
  for (const rel of internal) {
    const fm = parseFrontmatterBlock(read(rel));
    assert.match(
      fm,
      /^user-invocable:\s*false\s*$/m,
      `${rel}: canonical visibility is internal but generated frontmatter lacks user-invocable: false`,
    );
  }
});

test("V2: user-facing skills project no user-invocable key", () => {
  const internal = new Set(internalCanonicalSkills());
  let checked = 0;
  for (const scope of ["core", "workflows"]) {
    const genScope = join(REPO, "adapters/claude/skills", scope);
    let entries;
    try {
      entries = readdirSync(genScope);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const rel = `adapters/claude/skills/${scope}/${entry}/SKILL.md`;
      if (internal.has(rel)) continue;
      let text;
      try {
        text = read(rel);
      } catch {
        continue;
      }
      assert.doesNotMatch(
        parseFrontmatterBlock(text),
        /^user-invocable:/m,
        `${rel}: visibility is user, so nothing should be emitted (Claude defaults to user-invocable: true)`,
      );
      checked++;
    }
  }
  assert.ok(checked > 0, "expected to check at least one user-facing generated skill");
});

test("V3: disable-model-invocation is emitted nowhere in any generated host tree", () => {
  // THE TRAP. `disable-model-invocation: true` also hides a skill from the `/` menu and
  // additionally saves listing budget, which makes it the tempting mapping for
  // `visibility: internal`. It is wrong: it removes the skill from Claude's context
  // entirely (skills.md:249, :584 — "Claude can invoke: No"), which would sever
  // parent→child dispatch such as default-feature → implementation-planner. This test
  // exists so the substitution cannot be made silently by a later "optimization".
  // Generated subtrees only. `adapters/<host>/projection.md` is hand-authored prose that
  // documents WHY this field is banned, so scanning it would flag the documentation of
  // the rule as a violation of the rule.
  const roots = [
    "adapters/claude/skills", "adapters/claude/agents", "adapters/claude/commands",
    ".claude-plugin", ".codex", ".opencode", ".agents", ".codex-plugin",
  ];
  const hits = [];
  for (const root of roots) {
    for (const file of walkFiles(join(REPO, root))) {
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (text.includes("disable-model-invocation")) hits.push(file.slice(REPO.length + 1));
    }
  }
  assert.deepEqual(hits, [], `disable-model-invocation must never be emitted; found in: ${hits.join(", ")}`);
});

// ── M1: no Anthropic model ID leaks into an OpenCode or Codex artifact ────────
test("M1: no anthropic/* model ID is emitted into any OpenCode or Codex artifact", () => {
  // manifest/models.json once declared `opencode`/`codex` IDs (`anthropic/claude-*`) that
  // no consumer read — resolveClaudeModel() and resolveClaudeModelId() both dereference
  // `.claude` exclusively. They were removed in v0.2.1 because the declaration READ as
  // behaviour (that Aegis pins OpenCode/Codex users to Anthropic models). This pins the
  // claim so the next audit does not have to re-derive it by hand.
  const roots = [".opencode", ".codex", ".codex-plugin", ".agents"];
  const hits = [];
  for (const root of roots) {
    for (const file of walkFiles(join(REPO, root))) {
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      // Anchored to `anthropic/claude-` so an unrelated npm package name in prose
      // (e.g. the `@anthropic/sdk` line in the changelog-generation example) does not
      // masquerade as a model pin.
      if (/anthropic\/claude-/.test(text)) hits.push(file.slice(REPO.length + 1));
    }
  }
  assert.deepEqual(hits, [], `anthropic/claude-* model IDs must not reach OpenCode/Codex artifacts; found in: ${hits.join(", ")}`);
});

test("M1b: models.json declares no per-host IDs beyond claude", () => {
  const models = JSON.parse(read("manifest/models.json"));
  for (const [alias, entry] of Object.entries(models.aliases)) {
    assert.deepEqual(
      Object.keys(entry),
      ["claude"],
      `models.json alias '${alias}' declares keys other than 'claude' — only .claude is ever read (project.mjs resolveClaudeModel, lib/validate-permissions.mjs resolveClaudeModelId)`,
    );
  }
  // Intent tiers exist and the retired vendor names still resolve for back-compat.
  for (const tier of ["deep", "balanced", "fast", "inherit"]) {
    assert.ok(models.aliases[tier], `models.json is missing intent tier '${tier}'`);
  }
  for (const [old, tier] of [["opus", "deep"], ["sonnet", "balanced"], ["haiku", "fast"]]) {
    assert.equal(models.aliasOf[old], tier, `retired alias '${old}' must still resolve to '${tier}'`);
  }
  assert.equal(models.unknownAliasPolicy, "hard-fail", "unknownAliasPolicy must stay hard-fail so a typo is loud");
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
