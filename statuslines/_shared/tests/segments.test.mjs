// segments.test.mjs — AG-0259 Tier-1 unit tests: shared bar renderer,
// reset-time formatter, and the upgraded usage/context segments.
//
// Unit-level assertions import the pure helpers directly (no child process
// needed, mirrors the composability tests in runtime.test.mjs). One
// end-to-end child-process case at the bottom preserves the bulletproof
// exit-0 + non-empty-stdout invariant for a payload carrying rate_limits +
// context_window.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { renderBar, resolveBarColor } from "../lib/bar.mjs";
import { formatReset } from "../lib/reset-time.mjs";
import { buildCtx } from "../runtime.mjs";
import { loadTheme } from "../themes/loader.mjs";
import { render as renderUsage } from "../segments/usage.mjs";
import { render as renderContext, computeContextPct } from "../segments/context.mjs";
import { render as renderContextDetailed } from "../segments/context-detailed.mjs";
import { render as renderWorktree } from "../segments/worktree.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = dirname(HERE);
const RUNTIME = join(SHARED, "runtime.mjs");

const monoTheme = loadTheme("mono");
const defaultTheme = loadTheme("default");

// ── lib/bar.mjs ──────────────────────────────────────────────────────────

test("renderBar: 0% is an all-empty bar of the given width", () => {
  const ctx = buildCtx({}, monoTheme, {});
  const out = renderBar(ctx, { metric: "context", pct: 0, defaultColor: "contextBar" });
  assert.equal(out, "░".repeat(10));
});

test("renderBar: 50% fills half the cells (round-to-nearest)", () => {
  const ctx = buildCtx({}, monoTheme, {});
  const out = renderBar(ctx, { metric: "context", pct: 50, defaultColor: "contextBar" });
  assert.equal(out, "█".repeat(5) + "░".repeat(5));
});

test("renderBar: 100% is an all-filled bar", () => {
  const ctx = buildCtx({}, monoTheme, {});
  const out = renderBar(ctx, { metric: "context", pct: 100, defaultColor: "contextBar" });
  assert.equal(out, "█".repeat(10));
});

test("renderBar: pct is clamped to 0-100", () => {
  const ctx = buildCtx({}, monoTheme, {});
  assert.equal(renderBar(ctx, { metric: "context", pct: -20, defaultColor: "contextBar" }), "░".repeat(10));
  assert.equal(renderBar(ctx, { metric: "context", pct: 250, defaultColor: "contextBar" }), "█".repeat(10));
});

test("renderBar: custom width is honored", () => {
  const ctx = buildCtx({}, monoTheme, {});
  const out = renderBar(ctx, { metric: "context", pct: 50, width: 4, defaultColor: "contextBar" });
  assert.equal(out, "██░░");
});

test("resolveBarColor: threshold escalation wins over the default color key", () => {
  const ctx = buildCtx(
    {},
    defaultTheme,
    { thresholds: { context: [{ at: 90, color: "critical" }, { at: 70, color: "warning" }] } },
  );
  assert.equal(resolveBarColor(ctx, "context", 95, "contextBar"), "critical");
  assert.equal(resolveBarColor(ctx, "context", 75, "contextBar"), "warning");
  // Below every breakpoint -> no match -> falls back to the default key.
  assert.equal(resolveBarColor(ctx, "context", 10, "contextBar"), "contextBar");
});

test("resolveBarColor: no thresholds declared -> always the default color key", () => {
  const ctx = buildCtx({}, defaultTheme, {});
  assert.equal(resolveBarColor(ctx, "context", 99, "contextBar"), "contextBar");
  assert.equal(resolveBarColor(ctx, "usage", 99, "usageBar"), "usageBar");
});

test("renderBar: threshold color is actually applied to the ANSI output (default theme)", () => {
  const ctxNoThreshold = buildCtx({}, defaultTheme, {});
  const plain = renderBar(ctxNoThreshold, { metric: "usage", pct: 95, defaultColor: "usageBar" });
  // default theme: usageBar=green(32)
  assert.match(plain, /\x1b\[32m/);

  const ctxThreshold = buildCtx({}, defaultTheme, {
    thresholds: { usage: [{ at: 90, color: "critical" }] },
  });
  const escalated = renderBar(ctxThreshold, { metric: "usage", pct: 95, defaultColor: "usageBar" });
  // default theme: critical=red(31)
  assert.match(escalated, /\x1b\[31m/);
});

// ── lib/reset-time.mjs ───────────────────────────────────────────────────

const NOW_MS = Date.parse("2026-07-03T12:00:00.000Z");

test("formatReset: under an hour renders minutes only", () => {
  assert.equal(formatReset(NOW_MS + 45 * 60_000, NOW_MS), "45m");
});

test("formatReset: hours + minutes", () => {
  assert.equal(formatReset(NOW_MS + (2 * 60 + 55) * 60_000, NOW_MS), "2h 55m");
});

test("formatReset: exact hour omits the minutes remainder", () => {
  assert.equal(formatReset(NOW_MS + 3 * 3_600_000, NOW_MS), "3h");
});

test("formatReset: days + hours (>=24h)", () => {
  assert.equal(formatReset(NOW_MS + (2 * 24 + 10) * 3_600_000, NOW_MS), "2d 10h");
});

test("formatReset: exact days omits the hours remainder", () => {
  assert.equal(formatReset(NOW_MS + 3 * 24 * 3_600_000, NOW_MS), "3d");
});

test("formatReset: epoch-unit auto-detection — seconds vs milliseconds", () => {
  const futureMs = NOW_MS + 45 * 60_000;
  const futureSec = Math.round(futureMs / 1000);
  assert.equal(formatReset(futureMs, NOW_MS), "45m");
  assert.equal(formatReset(futureSec, NOW_MS), "45m");
});

test("formatReset: past timestamp -> \"\"", () => {
  assert.equal(formatReset(NOW_MS - 60_000, NOW_MS), "");
});

test("formatReset: absent/NaN/non-finite -> \"\"", () => {
  assert.equal(formatReset(undefined, NOW_MS), "");
  assert.equal(formatReset(null, NOW_MS), "");
  assert.equal(formatReset(NaN, NOW_MS), "");
  assert.equal(formatReset("not-a-date", NOW_MS), "");
  assert.equal(formatReset(0, NOW_MS), "");
  assert.equal(formatReset(-100, NOW_MS), "");
  assert.equal(formatReset(Infinity, NOW_MS), "");
});

// ── segments/usage.mjs ───────────────────────────────────────────────────

function usageCtx(data, descriptor = {}) {
  return buildCtx(data, monoTheme, descriptor);
}

test("usage: both windows present with resets_at renders bar+pct+reset for each", () => {
  const future5h = NOW_MS + (2 * 60 + 55) * 60_000;
  const future7d = NOW_MS + (2 * 24 + 10) * 3_600_000;
  const ctx = usageCtx({
    rate_limits: {
      five_hour: { used_percentage: 37, resets_at: Math.round(future5h / 1000) },
      seven_day: { used_percentage: 62, resets_at: Math.round(future7d / 1000) },
    },
  });
  const out = renderUsage(ctx);
  assert.match(out, /^Usage /);
  assert.match(out, /37%/);
  assert.match(out, /62%/);
  assert.match(out, /Weekly/);
  assert.ok(out.includes("·"), `expected a separator between windows, got: ${out}`);
});

test("usage: one window only -> other omitted, segment still renders", () => {
  const ctx = usageCtx({ rate_limits: { five_hour: { used_percentage: 10 } } });
  const out = renderUsage(ctx);
  assert.match(out, /Usage/);
  assert.ok(!out.includes("Weekly"), `expected no Weekly window, got: ${out}`);
});

test("usage: resets_at absent -> reset suffix omitted", () => {
  const ctx = usageCtx({ rate_limits: { five_hour: { used_percentage: 10 } } });
  const out = renderUsage(ctx);
  assert.ok(!out.includes("resets in"), `expected no reset suffix, got: ${out}`);
});

test("usage: resets_at in the past -> reset suffix omitted", () => {
  const ctx = usageCtx({
    rate_limits: { five_hour: { used_percentage: 10, resets_at: Math.round((NOW_MS - 60_000) / 1000) } },
  });
  const out = renderUsage(ctx);
  assert.ok(!out.includes("resets in"), `expected no reset suffix for a past reset, got: ${out}`);
});

test("usage: 0% still renders a bar (stable anchor)", () => {
  const ctx = usageCtx({ rate_limits: { five_hour: { used_percentage: 0 } } });
  const out = renderUsage(ctx);
  assert.match(out, /0%/);
});

test("usage: neither window present -> null", () => {
  assert.equal(renderUsage(usageCtx({ rate_limits: {} })), null);
  assert.equal(renderUsage(usageCtx({})), null);
});

// ── AG-0266: "(time)" not "(resets in time)"; joins with ctx.sep ────────────

test("usage: reset renders as '(<time>)', not 'resets in'", () => {
  // usage.mjs calls ctx.fmt.reset(resets_at) with no explicit "now" override,
  // so it resolves against the real wall clock — anchor the fixture to
  // Date.now() (unlike the NOW_MS-relative formatReset unit tests above).
  const future2h = Date.now() + 2 * 3_600_000;
  const ctx = usageCtx({
    rate_limits: { five_hour: { used_percentage: 37, resets_at: Math.round(future2h / 1000) } },
  });
  const out = renderUsage(ctx);
  // Tolerant match: the fixture is anchored to Date.now() + 2h, but usage.mjs
  // re-reads the wall clock, so Math.ceil rounding can tip the rendered value
  // to "1h NNm" or "2h" depending on the exact millisecond elapsed between
  // fixture construction and render — assert the parenthesised relative-time
  // SHAPE, not the exact hour count, to keep this deterministic.
  assert.match(out, /\(\d+h( \d+m)?\)/);
  assert.ok(!out.includes("resets in"), `expected no 'resets in' prefix, got: ${out}`);
});

test("usage: Usage/Weekly windows join with ctx.sep (default dot separator)", () => {
  const ctx = usageCtx({
    rate_limits: {
      five_hour: { used_percentage: 37 },
      seven_day: { used_percentage: 62 },
    },
  });
  const out = renderUsage(ctx);
  assert.ok(out.includes(" · "), `expected default ' · ' joiner, got: ${out}`);
});

test("usage: Usage/Weekly windows join with ctx.sep (honors descriptor.separator)", () => {
  const ctx = usageCtx(
    {
      rate_limits: {
        five_hour: { used_percentage: 37 },
        seven_day: { used_percentage: 62 },
      },
    },
    { separator: "|" },
  );
  const out = renderUsage(ctx);
  assert.ok(out.includes(" | "), `expected ' | ' joiner honoring descriptor.separator, got: ${out}`);
  assert.ok(!out.includes(" · "), `expected no default dot separator when descriptor.separator='|', got: ${out}`);
});

// ── segments/context.mjs — token-fallback percent (D4) ──────────────────

test("computeContextPct: used_percentage present is the primary path", () => {
  assert.equal(computeContextPct({ used_percentage: 42 }), 42);
});

test("computeContextPct: used_percentage absent falls back to token math", () => {
  const cw = {
    context_window_size: 200000,
    current_usage: { input_tokens: 8000, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 },
  };
  // (8000 + 2000) / 200000 * 100 = 5%
  assert.equal(computeContextPct(cw), 5);
});

test("computeContextPct: wholly missing usage/size -> 0, not a throw", () => {
  assert.equal(computeContextPct({}), 0);
  assert.equal(computeContextPct({ current_usage: null }), 0);
});

test("context segment: renders using the token-fallback percent when used_percentage is absent", () => {
  const ctx = usageCtx({
    context_window: {
      context_window_size: 200000,
      current_usage: { input_tokens: 8000, cache_read_input_tokens: 2000 },
    },
  });
  const out = renderContext(ctx);
  assert.match(out, /5%/);
});

test("context segment: wholly absent context_window -> null", () => {
  assert.equal(renderContext(usageCtx({})), null);
});

// ── segments/context.mjs + context-detailed.mjs — Context label (AG-0262 T2) ──

test("context segment: renders with the leading 'Context' label", () => {
  const ctx = usageCtx({ context_window: { used_percentage: 42 } });
  const out = renderContext(ctx);
  assert.match(out, /^Context /);
});

test("context-detailed segment: renders with the leading 'Context' label", () => {
  const ctx = usageCtx({ context_window: { used_percentage: 42 } });
  const out = renderContextDetailed(ctx);
  assert.match(out, /^Context /);
});

test("context segment: i18n override replaces the default 'Context' label", () => {
  const ctx = usageCtx(
    { context_window: { used_percentage: 10 } },
    { i18n: { labels: { context: "Contexto" } } },
  );
  const out = renderContext(ctx);
  assert.match(out, /^Contexto /);
});

// ── segments/worktree.mjs — AG-0268 dedicated worktree indicator ───────────

test("worktree: worktree.branch present alone (no workspace.git_worktree) -> null (no distinct name to show)", () => {
  const ctx = usageCtx({ worktree: { branch: "feature-x" } });
  assert.equal(renderWorktree(ctx), null);
});

test("worktree: workspace.git_worktree present (no worktree.branch) -> null (would duplicate git's branch)", () => {
  const ctx = usageCtx({ workspace: { git_worktree: "feat" } });
  assert.equal(renderWorktree(ctx), null);
});

test("worktree: worktree.branch distinct from workspace.git_worktree -> renders '🌳 wt:<name>'", () => {
  const ctx = usageCtx({ worktree: { branch: "main" }, workspace: { git_worktree: "feature-x" } });
  const out = renderWorktree(ctx);
  assert.match(out, /🌳 wt:feature-x/);
});

test("worktree: neither field present -> null", () => {
  assert.equal(renderWorktree(usageCtx({})), null);
  assert.equal(renderWorktree(usageCtx({ workspace: {}, worktree: {} })), null);
});

test("worktree: control chars are sanitized out of the rendered name (distinct-from-branch case)", () => {
  const ctx = usageCtx({ worktree: { branch: "main" }, workspace: { git_worktree: "feat\r\nINJECTED" } });
  const out = renderWorktree(ctx);
  assert.ok(out, "expected a rendered string, got null");
  // eslint-disable-next-line no-control-regex
  assert.ok(!/[\x00-\x1f\x7f]/.test(out.replace(/\x1b\[[0-9;]*m/g, "")), `expected no raw control chars, got: ${JSON.stringify(out)}`);
});

// ── end-to-end: bulletproof invariant preserved with rate_limits + context_window ──

test("e2e: usage + context payload -> exit 0, non-empty stdout", async () => {
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "aegis-sl-seg-"));
  const descriptorPath = join(tmp, "statusline.json");
  writeFileSync(
    descriptorPath,
    JSON.stringify({
      kind: "statusline",
      name: "test-seg",
      description: "test",
      visibility: "internal",
      platforms: ["claude"],
      theme: "hud",
      segments: [["model"], ["context", "usage"]],
      thresholds: {
        context: [{ at: 90, color: "critical" }, { at: 70, color: "warning" }],
        usage: [{ at: 90, color: "critical" }, { at: 70, color: "warning" }],
      },
    }),
  );
  const payload = JSON.stringify({
    model: { display_name: "Opus" },
    context_window: { used_percentage: 42 },
    rate_limits: {
      five_hour: { used_percentage: 37, resets_at: Math.round((Date.now() + 2 * 3_600_000) / 1000) },
      seven_day: { used_percentage: 62 },
    },
  });
  const r = spawnSync("node", [RUNTIME, descriptorPath], { input: payload, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /42%/);
  assert.match(r.stdout, /Usage/);
});
