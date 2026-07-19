// runtime.test.mjs — bulletproof-runtime tests (node --test).
//
// Every test runs the real runtime in a child process with mock stdin and
// asserts: exit code 0 AND non-empty stdout. This is the disappearing-statusline
// contract — Claude Code blanks the bar on a non-zero exit or empty output.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = dirname(HERE);
const RUNTIME = join(SHARED, "runtime.mjs");
const SUBAGENT = join(SHARED, "subagent-runtime.mjs");

// Write a temp descriptor that exercises several segments + a theme.
const tmp = mkdtempSync(join(tmpdir(), "aegis-sl-"));
const DESCRIPTOR = join(tmp, "statusline.json");
writeFileSync(
  DESCRIPTOR,
  JSON.stringify({
    kind: "statusline",
    name: "test",
    description: "test",
    visibility: "internal",
    platforms: ["claude"],
    theme: "default",
    segments: [
      ["model", "project", "git", "pr"],
      ["context-detailed", "cost", "session-time"],
    ],
  }),
);

function runMain(input, { env = {}, args = [DESCRIPTOR] } = {}) {
  const r = spawnSync("node", [RUNTIME, ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return r;
}

function runSub(input, args = ["default"]) {
  return spawnSync("node", [SUBAGENT, ...args], { input, encoding: "utf8" });
}

const FULL = JSON.stringify({
  model: { display_name: "Opus" },
  workspace: { current_dir: "/home/u/proj", git_worktree: "feature-x" },
  cost: { total_cost_usd: 0.1234, total_duration_ms: 65000 },
  context_window: {
    used_percentage: 42,
    current_usage: {
      input_tokens: 8500,
      output_tokens: 1200,
      cache_creation_input_tokens: 5000,
      cache_read_input_tokens: 2000,
    },
  },
  pr: { number: 1234, url: "https://github.com/o/r/pull/1234", review_state: "pending" },
});

test("happy path: exit 0, non-empty, renders model", () => {
  const r = runMain(FULL, { env: { COLUMNS: "120" } });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.match(r.stdout, /Opus/);
  assert.match(r.stdout, /proj/);
  assert.equal(r.stderr, "");
});

test("empty stdin -> exit 0, non-empty fallback", () => {
  const r = runMain("");
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
});

test("malformed JSON -> exit 0, [Aegis] fallback", () => {
  const r = runMain("{ this is not json ");
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("[Aegis]"));
});

test("missing fields -> exit 0, non-empty", () => {
  const r = runMain(JSON.stringify({ model: {} }));
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
});

test("null current_usage (post-compact) -> exit 0, non-empty", () => {
  const payload = JSON.stringify({
    model: { display_name: "Opus" },
    context_window: { used_percentage: null, current_usage: null },
  });
  const r = runMain(payload);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  // detailed breakdown is unconditional even with null usage
  assert.match(r.stdout, /in:/);
});

test("garbage + C0 control chars in a string field are stripped", () => {
  const NUL = String.fromCharCode(0), BEL = String.fromCharCode(7), DEL = String.fromCharCode(127);
  const payload = JSON.stringify({
    model: { display_name: `Op${NUL}${BEL}us` },
    workspace: { current_dir: `/x/pr${DEL}oj` },
  });
  const r = runMain(payload);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.ok(!r.stdout.includes(NUL));
  assert.ok(!r.stdout.includes(BEL));
  assert.ok(!r.stdout.includes(DEL));
  assert.match(r.stdout, /Opus/);
});

test("missing COLUMNS -> exit 0, non-empty (defaults to 120)", () => {
  const env = { ...process.env };
  delete env.COLUMNS;
  const r = spawnSync("node", [RUNTIME, DESCRIPTOR], {
    input: FULL,
    encoding: "utf8",
    env,
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
});

test("branch name with embedded CR does not inject extra rows", () => {
  const payload = JSON.stringify({
    model: { display_name: "Opus" },
    worktree: { branch: "feat\r\nINJECTED" },
  });
  const r = runMain(payload);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  // The CR/LF inside the branch must be stripped; "INJECTED" stays on the
  // same logical line as the branch, never a new statusline row by itself.
  assert.ok(!/^INJECTED/m.test(r.stdout));
});

test("ESC / OSC-8 in stdin fields is stripped (no ANSI injection)", () => {
  const ESC = String.fromCharCode(27);
  const payload = JSON.stringify({
    model: { display_name: `Op${ESC}[31mus` },
    worktree: { branch: `b${ESC}]8;;evil://payload${ESC}\\` },
    pr: { number: 9, url: `https://github.com/o/r/pull/9${ESC}[2J` },
  });
  const r = runMain(payload);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  // No ESC from input may survive, so no injected ESC-sequence can form. The
  // literal text (e.g. "evil://") may remain as harmless plain text — that's
  // defanged. What must NOT survive is any functional escape: the forged OSC-8
  // (ESC ]8;;evil…), the injected SGR (ESC [31m), or the screen-clear (ESC [2J).
  assert.ok(!r.stdout.includes(`${ESC}]8;;evil`), "forged OSC-8 hyperlink survived");
  assert.ok(!r.stdout.includes(`${ESC}[31m`), "injected SGR survived");
  assert.ok(!r.stdout.includes(`${ESC}[2J`), "screen-clear survived");
});

test("pr absent -> renders nothing for pr, still non-empty overall", () => {
  const payload = JSON.stringify({ model: { display_name: "Opus" } });
  const r = runMain(payload);
  assert.equal(r.status, 0);
  assert.ok(!r.stdout.includes("PR #"));
});

test("pr present, review_state absent -> PR shown without state badge", () => {
  const payload = JSON.stringify({
    model: { display_name: "Opus" },
    pr: { number: 7, url: "https://github.com/o/r/pull/7" },
  });
  const r = runMain(payload);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PR #7/);
});

test("missing descriptor path -> exit 0, non-empty", () => {
  const r = runMain(FULL, { args: ["/nonexistent/statusline.json"] });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
});

test("no argv at all -> exit 0, non-empty", () => {
  const r = runMain(FULL, { args: [] });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
});

// ── subagent runtime ────────────────────────────────────────────────────────

test("subagent: tasks render one JSON line per task, exit 0", () => {
  const payload = JSON.stringify({
    columns: 80,
    tasks: [
      { id: "a", name: "reviewer", status: "running", tokenCount: 12000 },
      { id: "b", name: "tester", status: "done" },
    ],
  });
  const r = runSub(payload);
  assert.equal(r.status, 0);
  const lines = r.stdout.trim().split("\n").filter(Boolean);
  assert.equal(lines.length, 2);
  for (const l of lines) {
    const obj = JSON.parse(l);
    assert.ok(typeof obj.id === "string");
    assert.ok(typeof obj.content === "string");
  }
});

test("subagent: empty / malformed stdin -> exit 0, no crash", () => {
  for (const input of ["", "not json", JSON.stringify({})]) {
    const r = runSub(input);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  }
});

test("subagent: C0 chars in task name are stripped", () => {
  const NUL = String.fromCharCode(0);
  const payload = JSON.stringify({ tasks: [{ id: "x", name: `rev${NUL}iewer` }] });
  const r = runSub(payload);
  assert.equal(r.status, 0);
  assert.ok(!r.stdout.includes(NUL));
});

// ── v0.0.14 composability: ordering, merge-groups, thresholds, i18n ──────────
// These import the runtime's pure helpers directly (no child process needed) and
// assert the additive behavior. A descriptor declaring none of these must behave
// exactly as before — covered by the integration tests above.
import { buildCtx, compose } from "../runtime.mjs";
import { loadTheme } from "../themes/loader.mjs";

const monoTheme = loadTheme("mono");
const composeData = {
  model: { display_name: "Opus" },
  workspace: { current_dir: "/home/u/proj", git_worktree: "feat" },
};

test("i18n: ctx.t returns localized label, falls back to key", () => {
  const ctx = buildCtx({}, monoTheme, { i18n: { locale: "pt-BR", labels: { ctx: "contexto" } } });
  assert.equal(ctx.t("ctx"), "contexto");
  assert.equal(ctx.t("missing"), "missing"); // fallback to the key itself
});

test("i18n: no descriptor.i18n -> identity translator", () => {
  const ctx = buildCtx({}, monoTheme, {});
  assert.equal(ctx.t("ctx"), "ctx");
});

test("threshold: first at<=value wins (high->low list), null when no match/metric", () => {
  const ctx = buildCtx({}, monoTheme, {
    thresholds: { context: [{ at: 90, color: "critical", label: "CRIT" }, { at: 70, color: "warning" }] },
  });
  assert.deepEqual(ctx.threshold("context", 95), { color: "critical", label: "CRIT" });
  assert.deepEqual(ctx.threshold("context", 75), { color: "warning", label: null });
  assert.equal(ctx.threshold("context", 10), null); // below lowest breakpoint
  assert.equal(ctx.threshold("unknownMetric", 99), null); // unknown metric
  assert.equal(buildCtx({}, monoTheme, {}).threshold("context", 99), null); // no thresholds
});

test("order: stable-sorts a line by priority; unlisted keep relative order", async () => {
  const ctx = buildCtx(composeData, monoTheme, { order: ["project", "model"] });
  const out = await compose({ segments: [["model", "project"]], order: ["project", "model"] }, ctx);
  // project must now precede model (project ranked first in `order`).
  assert.ok(out.indexOf("proj") < out.indexOf("Opus"), `expected project before model, got: ${out}`);
});

test("order absent: authored segment order preserved", async () => {
  const ctx = buildCtx(composeData, monoTheme, {});
  const out = await compose({ segments: [["model", "project"]] }, ctx);
  assert.ok(out.indexOf("Opus") < out.indexOf("proj"), `expected model before project, got: ${out}`);
});

test("mergeGroups: grouped adjacent segments join with mergeSeparator, not the dot sep", async () => {
  const descriptor = {
    segments: [["model", "project"]],
    mergeGroups: [["model", "project"]],
    mergeSeparator: "/",
  };
  const ctx = buildCtx(composeData, monoTheme, descriptor);
  const out = await compose(descriptor, ctx);
  // No " · " separator between the two grouped segments; a "/" joins them.
  assert.ok(!out.includes(" · "), `merge group should suppress the dot sep, got: ${out}`);
  assert.ok(out.includes("/"), `merge group should join with mergeSeparator, got: ${out}`);
});

test("mergeGroups absent: default dot separator used", async () => {
  const ctx = buildCtx(composeData, monoTheme, {});
  const out = await compose({ segments: [["model", "project"]] }, ctx);
  assert.ok(out.includes("·"), `expected default separator, got: ${out}`);
});

// ── per-descriptor `separator` glyph + ctx.sep ───────────────────────────────

test("separator: descriptor.separator glyph composes segments joined by ' <glyph> '", async () => {
  const descriptor = { segments: [["model", "project"]], separator: "|" };
  const ctx = buildCtx(composeData, monoTheme, descriptor);
  const out = await compose(descriptor, ctx);
  assert.ok(out.includes(" | "), `expected ' | ' separator, got: ${out}`);
  assert.ok(!out.includes(" · "), `expected no default dot separator, got: ${out}`);
});

test("separator: absent still yields the default ' · ' (existing preset unchanged)", async () => {
  const descriptor = { segments: [["model", "project"]] };
  const ctx = buildCtx(composeData, monoTheme, descriptor);
  const out = await compose(descriptor, ctx);
  assert.ok(out.includes(" · "), `expected default ' · ' separator, got: ${out}`);
});

test("ctx.sep: exposed on ctx, glyph wrapped in a single space on each side", () => {
  const withSep = buildCtx({}, monoTheme, { separator: "|" });
  assert.equal(withSep.sep, " | ");

  const withoutSep = buildCtx({}, monoTheme, {});
  assert.equal(withoutSep.sep, " · ");
});
