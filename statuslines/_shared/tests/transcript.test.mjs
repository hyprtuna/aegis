// transcript.test.mjs — AG-0260 Tier-2 tests: the guarded transcript reader
// (lib/transcript.mjs), the runtime's gated pre-parse (descriptorNeedsTranscript
// in runtime.mjs), and the enriched/new HUD segments that consume ctx.transcript.
//
// Unit-level assertions import the pure functions directly. A handful of
// end-to-end child-process cases at the bottom preserve the bulletproof
// exit-0 + non-empty-stdout invariant when a transcript is missing, malformed,
// or a real fixture.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";

import { readTranscript, _setReadImplForTests, _setReadTailImplForTests } from "../lib/transcript.mjs";
import { buildCtx, descriptorNeedsTranscript } from "../runtime.mjs";
import { loadTheme } from "../themes/loader.mjs";
import { render as renderTools } from "../segments/tools.mjs";
import { render as renderAgents } from "../segments/agents.mjs";
import { render as renderTodos } from "../segments/todos.mjs";
import { render as renderTaskBanner } from "../segments/task-banner.mjs";
import { render as renderClaudeMd } from "../segments/claude-md.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED = dirname(HERE);
const RUNTIME = join(SHARED, "runtime.mjs");
const FIXTURE = join(HERE, "fixtures", "transcript-sample.jsonl");

const monoTheme = loadTheme("mono");

function ctxWith(transcript, data = {}) {
  return buildCtx(data, monoTheme, {}, transcript);
}

// Copy the committed fixture into a fresh temp file so each test gets its own
// mtime/size (and therefore its own cache entry) without mutating the tracked
// fixture.
function copyFixture(prefix = "aegis-transcript-") {
  const tmp = mkdtempSync(join(tmpdir(), prefix));
  const dest = join(tmp, "transcript.jsonl");
  writeFileSync(dest, readFileSync(FIXTURE, "utf8"));
  return dest;
}

// ── lib/transcript.mjs — readTranscript() ───────────────────────────────────

test("readTranscript: parses the fixture into the documented summary shape", () => {
  const summary = readTranscript(copyFixture());
  assert.ok(summary, "expected a non-null summary");

  // tools: Bash called twice (tu_1 completed, tu_2 errored) -> aggregated to
  // one entry, count 2, status reflects the LAST observed call (error).
  assert.equal(summary.tools.length, 1);
  assert.equal(summary.tools[0].name, "Bash");
  assert.equal(summary.tools[0].count, 2);
  assert.equal(summary.tools[0].status, "error");
  assert.equal(summary.tools[0].target, "npm run build");

  // agents: one Task tool_use -> agent, completed 2s after it started.
  assert.equal(summary.agents.length, 1);
  assert.equal(summary.agents[0].type, "code-explorer");
  assert.equal(summary.agents[0].model, "opus");
  assert.equal(summary.agents[0].description, "map auth module call chains");
  assert.equal(summary.agents[0].status, "completed");
  assert.equal(summary.agents[0].durationMs, 2000);

  // todos: latest TodoWrite -> 1 completed, 1 in_progress, 1 pending, total 3.
  assert.deepEqual(summary.todos, { done: 1, total: 3, inProgress: "Add tests for auth module" });

  // prompt: the LAST user string-content message wins (not the tool_result
  // "user" turns, which carry array content).
  assert.equal(summary.prompt, "Great, now update the README too.");
});

test("readTranscript: malformed line mid-stream is skipped, not fatal (partial-parse tolerance)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-malformed-"));
  const path = join(tmp, "transcript.jsonl");
  const lines = [
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-03T10:00:00.000Z",
      message: { content: [{ type: "tool_use", id: "a", name: "Read", input: { file_path: "/x/y.ts" } }] },
    }),
    "not valid json at all {{{",
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:01.000Z",
      message: { content: [{ type: "tool_result", tool_use_id: "a", is_error: false }] },
    }),
  ];
  writeFileSync(path, lines.join("\n"));

  const summary = readTranscript(path);
  assert.ok(summary, "a malformed line must not null out the whole parse");
  assert.equal(summary.tools.length, 1);
  assert.equal(summary.tools[0].name, "Read");
  assert.equal(summary.tools[0].status, "completed");
  assert.equal(summary.tools[0].target, "/x/y.ts");
});

test("readTranscript: prompt echo skips harness envelopes (command + local-command-stdout), keeps the genuine prompt", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-envelope-"));
  const path = join(tmp, "transcript.jsonl");
  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:00.000Z",
      message: { content: "Please refactor the auth module." },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:05.000Z",
      message: {
        content:
          "<command-message>aegis:statusline</command-message>\n<command-name>/aegis:statusline</command-name>",
      },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:06.000Z",
      message: { content: "<local-command-stdout>ok</local-command-stdout>" },
    }),
  ];
  writeFileSync(path, lines.join("\n"));

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.prompt, "Please refactor the auth module.");
});

test("readTranscript: a genuine prompt that QUOTES command markup mid-body is kept, not skipped", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-quote-"));
  const path = join(tmp, "transcript.jsonl");
  // A real bug report that quotes `<command-name>` in its body must NOT be
  // treated as a harness envelope — envelopes START with the tag; a quote does not.
  const genuine = "statusline top line shows `<command-name>/aegis:statusline</command-name>` — fix it";
  writeFileSync(
    path,
    JSON.stringify({ type: "user", timestamp: "2026-07-03T10:00:00.000Z", message: { content: genuine } }),
  );

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.prompt, genuine);
});

test("readTranscript: prompt echo skips a <task-notification> envelope, keeps the prior genuine prompt", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-task-notif-"));
  const path = join(tmp, "transcript.jsonl");
  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:00.000Z",
      message: { content: "Please refactor the auth module." },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:05.000Z",
      message: {
        content:
          "<task-notification><task-id>a18683386cb879a51</task-id><tool-use-id>toolu_01UHo</tool-use-id></task-notification>",
      },
    }),
  ];
  writeFileSync(path, lines.join("\n"));

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.prompt, "Please refactor the auth module.");
});

test("readTranscript: prompt echo skips a <system-reminder> envelope, keeps the prior genuine prompt", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-sys-reminder-"));
  const path = join(tmp, "transcript.jsonl");
  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:00.000Z",
      message: { content: "Please refactor the auth module." },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:05.000Z",
      message: { content: "<system-reminder>Some injected harness context.</system-reminder>" },
    }),
  ];
  writeFileSync(path, lines.join("\n"));

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.prompt, "Please refactor the auth module.");
});

test("readTranscript: a genuine prompt that QUOTES task-notification/system-reminder markup is kept, not skipped", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-quote-2-"));
  const path = join(tmp, "transcript.jsonl");
  // Real prose that quotes the markup mid-body must NOT be treated as an
  // envelope — envelopes START with the tag; a quote does not.
  const genuine =
    "the HUD top line showed `<task-notification><task-id>a18683386cb879a51</task-id>` and also a stray `<system-reminder>` — fix it";
  writeFileSync(
    path,
    JSON.stringify({ type: "user", timestamp: "2026-07-03T10:00:00.000Z", message: { content: genuine } }),
  );

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.prompt, genuine);
});

test("readTranscript: an all-envelope transcript (no genuine user turn) -> prompt: null", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-envelope-only-"));
  const path = join(tmp, "transcript.jsonl");
  const lines = [
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:00.000Z",
      message: { content: "<command-name>/aegis:statusline</command-name>" },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:01.000Z",
      message: { content: "<local-command-stdout>done</local-command-stdout>" },
    }),
  ];
  writeFileSync(path, lines.join("\n"));

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.prompt, null);
});

test("readTranscript: tools array is recency-ordered, most-recently-used LAST, not sorted by count", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-recency-"));
  const path = join(tmp, "transcript.jsonl");
  const lines = [
    // Bash is called twice (higher count) and its LATEST call errors...
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-03T10:00:00.000Z",
      message: { content: [{ type: "tool_use", id: "a", name: "Bash", input: { command: "npm test" } }] },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:01.000Z",
      message: { content: [{ type: "tool_result", tool_use_id: "a", is_error: false }] },
    }),
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-03T10:00:02.000Z",
      message: { content: [{ type: "tool_use", id: "b", name: "Bash", input: { command: "npm run build" } }] },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:03.000Z",
      message: { content: [{ type: "tool_result", tool_use_id: "b", is_error: true }] },
    }),
    // ...but Edit is called AFTER, so Edit is the most-recent activity.
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-03T10:00:04.000Z",
      message: { content: [{ type: "tool_use", id: "c", name: "Edit", input: { file_path: "/x.ts" } }] },
    }),
    JSON.stringify({
      type: "user",
      timestamp: "2026-07-03T10:00:05.000Z",
      message: { content: [{ type: "tool_result", tool_use_id: "c", is_error: false }] },
    }),
  ];
  writeFileSync(path, lines.join("\n"));

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary");
  assert.equal(summary.tools.length, 2);
  // Bash has the higher count (2) but is NOT the most recent -> comes FIRST.
  assert.equal(summary.tools[0].name, "Bash");
  assert.equal(summary.tools[0].count, 2);
  assert.equal(summary.tools[0].status, "error");
  // Edit is the most-recently-used tool -> comes LAST.
  assert.equal(summary.tools[1].name, "Edit");
  assert.equal(summary.tools[1].count, 1);
  assert.equal(summary.tools[1].status, "completed");
});

test("readTranscript: missing path -> null", () => {
  assert.equal(readTranscript("/definitely/not/a/real/path/aegis-nope.jsonl"), null);
});

test("readTranscript: absent/empty/non-string path -> null, never throws", () => {
  assert.equal(readTranscript(undefined), null);
  assert.equal(readTranscript(null), null);
  assert.equal(readTranscript(""), null);
  assert.equal(readTranscript(42), null);
  assert.equal(readTranscript({}), null);
});

test("readTranscript: a directory (not a file) -> null", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-dir-"));
  assert.equal(readTranscript(tmp), null);
});

test("readTranscript: cache hit does not re-read the transcript file (D1)", () => {
  const path = copyFixture("aegis-transcript-cache-");
  let reads = 0;
  _setReadImplForTests((p, enc) => {
    reads += 1;
    return readFileSync(p, enc);
  });
  try {
    const first = readTranscript(path);
    assert.ok(first);
    assert.equal(reads, 1, "expected exactly one real read on cache miss");

    const second = readTranscript(path);
    assert.ok(second);
    assert.equal(reads, 1, "cache hit must not trigger another real read");
    assert.deepEqual(second, first);
  } finally {
    _setReadImplForTests(null);
  }
});

test("readTranscript: a file above the read ceiling uses a trailing-window read and still parses recent activity", () => {
  const MAX_READ_BYTES = 2 * 1024 * 1024;
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-large-"));
  const path = join(tmp, "transcript.jsonl");
  // One oversized "line" (no embedded newlines) larger than the ceiling,
  // followed by the real fixture content. The trailing-window read must land
  // inside the padding, drop that partial first line, and still parse the
  // fixture's tail intact.
  const padding = "x".repeat(MAX_READ_BYTES);
  const fixtureText = readFileSync(FIXTURE, "utf8");
  writeFileSync(path, `${padding}\n${fixtureText}`);

  const stat = statSync(path);
  assert.ok(
    stat.size > MAX_READ_BYTES,
    "fixture setup must exceed the read ceiling to exercise the trailing-window path",
  );

  const summary = readTranscript(path);
  assert.ok(summary, "expected a non-null summary from a valid large file (never null)");
  assert.equal(summary.tools.length, 1);
  assert.equal(summary.tools[0].name, "Bash");
  assert.equal(summary.tools[0].status, "error");
  assert.equal(summary.prompt, "Great, now update the README too.");
});

test("readTranscript: a trailing-window read failure -> null, never throws (D2)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-transcript-large-err-"));
  const path = join(tmp, "transcript.jsonl");
  writeFileSync(path, "x".repeat(3 * 1024 * 1024));

  _setReadTailImplForTests(() => {
    throw new Error("boom");
  });
  try {
    assert.equal(readTranscript(path), null);
  } finally {
    _setReadTailImplForTests(null);
  }
});

// ── runtime.mjs — descriptorNeedsTranscript() (D6 gate) ─────────────────────

test("descriptorNeedsTranscript: true when any transcript-derived segment is present", () => {
  assert.equal(descriptorNeedsTranscript({ segments: [["model"], ["tools"]] }), true);
  assert.equal(descriptorNeedsTranscript({ segments: [["agents"]] }), true);
  assert.equal(descriptorNeedsTranscript({ segments: [["todos"]] }), true);
  assert.equal(descriptorNeedsTranscript({ segments: [["task-banner"]] }), true);
});

test("descriptorNeedsTranscript: false when no transcript-derived segment is present (incl. claude-md)", () => {
  assert.equal(descriptorNeedsTranscript({ segments: [["model"], ["claude-md"]] }), false);
  assert.equal(descriptorNeedsTranscript({ segments: [["model", "project", "git"]] }), false);
});

test("descriptorNeedsTranscript: absent/malformed descriptor -> false, never throws", () => {
  assert.equal(descriptorNeedsTranscript(undefined), false);
  assert.equal(descriptorNeedsTranscript(null), false);
  assert.equal(descriptorNeedsTranscript({}), false);
  assert.equal(descriptorNeedsTranscript({ segments: "not-an-array" }), false);
});

// ── enriched segments: tools / agents / todos ───────────────────────────────
// AG-0267: tools/agents now render ALL relevant activity (claude-hud parity),
// not just the single most-recent entry — see segments/tools.mjs and
// segments/agents.mjs headers for the full model.

test("tools: single tool in transcript renders with icon + ×count", () => {
  const ctx = ctxWith({ tools: [{ name: "Bash", count: 20, status: "completed" }] });
  assert.equal(renderTools(ctx), "✓ Bash ×20");
});

test("tools: running/error status maps to the right icon, ×count always shown for completed/error", () => {
  assert.equal(renderTools(ctxWith({ tools: [{ name: "Bash", count: 1, status: "running" }] })), "◐ Bash");
  assert.equal(renderTools(ctxWith({ tools: [{ name: "Bash", count: 1, status: "error" }] })), "✗ Bash ×1");
});

test("tools: running entries render first, last 2 only, name only (no count)", () => {
  const ctx = ctxWith({
    tools: [
      { name: "Grep", count: 1, status: "running" },
      { name: "Read", count: 1, status: "running" },
      { name: "Glob", count: 1, status: "running" },
    ],
  });
  // 3 running entries -> only the LAST 2 (recency-ordered array) are shown.
  assert.equal(renderTools(ctx), `◐ Read${ctx.sep}◐ Glob`);
});

test("tools: completed/error entries sorted by count DESC, top 4, with a +N more overflow marker", () => {
  const ctx = ctxWith({
    tools: [
      { name: "A", count: 1, status: "completed" },
      { name: "B", count: 15, status: "error" },
      { name: "C", count: 5, status: "completed" },
      { name: "D", count: 2, status: "completed" },
      { name: "E", count: 8, status: "completed" },
    ],
  });
  // Sorted by count DESC: B(15) E(8) C(5) D(2) A(1) -> top 4 shown, A hidden.
  assert.equal(
    renderTools(ctx),
    `✗ B ×15${ctx.sep}✓ E ×8${ctx.sep}✓ C ×5${ctx.sep}✓ D ×2${ctx.sep}+1 more`,
  );
});

test("tools: running + completed combine, running first, per-entry status color independent", () => {
  const ctx = ctxWith({
    tools: [
      { name: "Bash", count: 15, status: "error" },
      { name: "Edit", count: 2, status: "completed" },
      { name: "Write", count: 1, status: "running" },
    ],
  });
  // A stale error on a high-count tool (Bash) only reddens its OWN entry.
  assert.equal(renderTools(ctx), `◐ Write${ctx.sep}✗ Bash ×15${ctx.sep}✓ Edit ×2`);
});

test("tools: MCP tool names are shortened to the segment after the last __", () => {
  const ctx = ctxWith({ tools: [{ name: "mcp__filesystem__read_file", count: 3, status: "completed" }] });
  assert.equal(renderTools(ctx), "✓ read_file ×3");
});

test("tools: parts are joined with ctx.sep", () => {
  const ctx = ctxWith({
    tools: [
      { name: "Bash", count: 2, status: "completed" },
      { name: "Edit", count: 1, status: "completed" },
    ],
  });
  assert.ok(renderTools(ctx).includes(ctx.sep), "expected the join to use ctx.sep");
});

test("tools: falls back to ' | ' when ctx.sep is somehow absent", () => {
  const ctx = ctxWith({
    tools: [
      { name: "Bash", count: 2, status: "completed" },
      { name: "Edit", count: 1, status: "completed" },
    ],
  });
  delete ctx.sep;
  assert.equal(renderTools(ctx), "✓ Bash ×2 | ✓ Edit ×1");
});

test("tools: falls back to stdin field when ctx.transcript is absent (no regression)", () => {
  const ctx = ctxWith(null, { tools: [1, 2, 3] });
  assert.equal(renderTools(ctx), "⚒ 3");
});

test("tools: no transcript and no stdin field -> null (degrade-to-null)", () => {
  assert.equal(renderTools(ctxWith(null, {})), null);
});

test("agents: transcript present -> icon + type [model]: description (duration)", () => {
  const ctx = ctxWith({
    agents: [{ type: "code-explorer", model: "opus", description: "map auth", durationMs: 2000, status: "completed" }],
  });
  assert.equal(renderAgents(ctx), "✓ code-explorer [opus]: map auth (2s)");
});

test("agents: running agent uses the running icon and no duration when absent", () => {
  const ctx = ctxWith({ agents: [{ type: "researcher", status: "running" }] });
  assert.equal(renderAgents(ctx), "◐ researcher");
});

test("agents: multiple agents render as multiple lines, one per agent, \\n-joined", () => {
  const ctx = ctxWith({
    agents: [
      { type: "researcher", status: "completed", durationMs: 3000 },
      { type: "code-explorer", model: "haiku", status: "running" },
    ],
  });
  const out = renderAgents(ctx);
  assert.ok(out.includes("\n"), "expected multiple agents to render on separate lines");
  const lines = out.split("\n");
  assert.equal(lines.length, 2);
  // Running entries render first, then the recent-completed ones.
  assert.equal(lines[0], "◐ code-explorer [haiku]");
  assert.equal(lines[1], "✓ researcher (3s)");
});

test("agents: running + last-2-completed, capped at 3, keeping the most recent", () => {
  const ctx = ctxWith({
    agents: [
      { type: "one", status: "completed" },
      { type: "two", status: "completed" },
      { type: "three", status: "completed" },
      { type: "four", status: "running" },
    ],
  });
  // 3 completed -> last 2 kept ("two", "three") + the running one ("four") = 3.
  // Running entries render first, then the recent-completed ones.
  const out = renderAgents(ctx);
  const lines = out.split("\n");
  assert.equal(lines.length, 3);
  assert.deepEqual(lines, ["◐ four", "✓ two", "✓ three"]);
});

test("agents: running agents are never dropped for completed ones when over the cap", () => {
  const ctx = ctxWith({
    agents: [
      { type: "one", status: "completed" },
      { type: "two", status: "completed" },
      { type: "three", status: "running" },
      { type: "four", status: "running" },
    ],
  });
  // 2 running + 2 completed, MAX_AGENTS_SHOWN=3 -> both running agents must
  // survive the cap (running is prioritized, never dropped for completed).
  const out = renderAgents(ctx);
  const lines = out.split("\n");
  assert.equal(lines.length, 3);
  assert.ok(lines.includes("◐ three"), `expected running agent 'three' to survive, got: ${out}`);
  assert.ok(lines.includes("◐ four"), `expected running agent 'four' to survive, got: ${out}`);
});

test("agents: falls back to stdin agent.name when ctx.transcript is absent (no regression)", () => {
  const ctx = ctxWith(null, { agent: { name: "explorer" } });
  assert.equal(renderAgents(ctx), "@explorer");
});

test("agents: no transcript and no stdin field -> null (degrade-to-null)", () => {
  assert.equal(renderAgents(ctxWith(null, {})), null);
});

test("todos: transcript present -> in-progress content + done/total", () => {
  const ctx = ctxWith({ todos: { done: 21, total: 39, inProgress: "Fix the thing" } });
  assert.equal(renderTodos(ctx), "▸ Fix the thing (21/39)");
});

test("todos: transcript present, no in-progress item -> counts only", () => {
  const ctx = ctxWith({ todos: { done: 3, total: 3, inProgress: null } });
  assert.equal(renderTodos(ctx), "▸ (3/3)");
});

test("todos: falls back to stdin field when ctx.transcript is absent (no regression)", () => {
  const ctx = ctxWith(null, { todos: { completed: 2, total: 5 } });
  assert.equal(renderTodos(ctx), "☐ 2/5");
});

// ── new segments: task-banner / claude-md ───────────────────────────────────

test("task-banner: renders the in-progress todo as a banner", () => {
  const ctx = ctxWith({ todos: { done: 1, total: 3, inProgress: "Add tests" } });
  assert.equal(renderTaskBanner(ctx), "▶ Add tests");
});

test("task-banner: null when transcript absent or no in-progress todo", () => {
  assert.equal(renderTaskBanner(ctxWith(null)), null);
  assert.equal(renderTaskBanner(ctxWith({ todos: null })), null);
  assert.equal(renderTaskBanner(ctxWith({ todos: { done: 3, total: 3, inProgress: null } })), null);
});

test("claude-md: counts CLAUDE.md/AGENTS.md upward to the repo root, plus the home file", () => {
  const root = mkdtempSync(join(tmpdir(), "aegis-claudemd-"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, "CLAUDE.md"), "# root");
  mkdirSync(join(root, "sub"), { recursive: true });
  writeFileSync(join(root, "sub", "AGENTS.md"), "# sub");
  mkdirSync(join(root, "sub", "leaf"), { recursive: true });

  const homeClaudeMd = existsSync(join(homedir(), ".claude", "CLAUDE.md")) ? 1 : 0;
  const expected = 2 + homeClaudeMd; // sub/AGENTS.md + root/CLAUDE.md (+ home, if present)

  const ctx = ctxWith(null, { workspace: { current_dir: join(root, "sub", "leaf") } });
  assert.equal(renderClaudeMd(ctx), `${expected} CLAUDE.md`);
});

test("claude-md: null when cwd is unknown", () => {
  assert.equal(renderClaudeMd(ctxWith(null, {})), null);
});

test("claude-md: null when the walk finds nothing and there is no home file", () => {
  // A fresh temp dir with no CLAUDE.md/AGENTS.md anywhere above it and no
  // .git marker; the walk still terminates via MAX_DEPTH. We can't control
  // whether ~/.claude/CLAUDE.md exists on the host running the test, so only
  // assert the shape holds (renders null OR a home-file-only count).
  const leaf = mkdtempSync(join(tmpdir(), "aegis-claudemd-empty-"));
  const homeClaudeMd = existsSync(join(homedir(), ".claude", "CLAUDE.md")) ? 1 : 0;
  const ctx = ctxWith(null, { workspace: { current_dir: leaf } });
  const out = renderClaudeMd(ctx);
  if (homeClaudeMd === 0) {
    assert.equal(out, null);
  } else {
    assert.equal(out, "1 CLAUDE.md");
  }
});

// ── end-to-end: bulletproof invariant preserved with a transcript_path ──────

function descriptorPath(segmentsLines) {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-sl-transcript-"));
  const path = join(tmp, "statusline.json");
  writeFileSync(
    path,
    JSON.stringify({
      kind: "statusline",
      name: "test-transcript",
      description: "test",
      visibility: "internal",
      platforms: ["claude"],
      theme: "hud",
      segments: segmentsLines,
    }),
  );
  return path;
}

test("e2e: missing transcript_path degrades transcript segments to null, other segments unaffected", () => {
  const descriptor = descriptorPath([["model"], ["tools", "agents", "todos", "task-banner"]]);
  const payload = JSON.stringify({
    model: { display_name: "Opus" },
    transcript_path: "/definitely/not/a/real/transcript/aegis-nope.jsonl",
  });
  const r = spawnSync("node", [RUNTIME, descriptor], { input: payload, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /Opus/);
});

test("e2e: a garbage (non-JSONL) transcript file never crashes the runtime", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aegis-sl-garbage-"));
  const transcriptPath = join(tmp, "garbage.jsonl");
  writeFileSync(transcriptPath, "\x00\x01\xFF not json at all\n{{{{\n");

  const descriptor = descriptorPath([["model"], ["tools", "agents", "todos"]]);
  const payload = JSON.stringify({ model: { display_name: "Opus" }, transcript_path: transcriptPath });
  const r = spawnSync("node", [RUNTIME, descriptor], { input: payload, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.equal(r.stderr, "");
});

test("e2e: real fixture transcript renders enriched tool/agent/todo detail", () => {
  const transcriptPath = copyFixture("aegis-sl-fixture-");
  const descriptor = descriptorPath([
    ["model"],
    ["tools", "agents", "todos"],
    ["task-banner"],
  ]);
  const payload = JSON.stringify({ model: { display_name: "Opus" }, transcript_path: transcriptPath });
  const r = spawnSync("node", [RUNTIME, descriptor], { input: payload, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /Bash/);
  assert.match(r.stdout, /code-explorer/);
  assert.match(r.stdout, /\(1\/3\)/);
  assert.match(r.stdout, /Add tests for auth module/);
});

test("e2e: a preset with no transcript-derived segments never touches the transcript (D6)", () => {
  // Point transcript_path at a directory (guaranteed to fail readTranscript's
  // isFile() check if it were ever read) — the descriptor only has non-Tier-2
  // segments, so the gate should skip the read entirely and the bar renders
  // exactly as if transcript_path were absent.
  const tmp = mkdtempSync(join(tmpdir(), "aegis-sl-gate-"));
  const descriptor = descriptorPath([["model", "claude-md"]]);
  const payload = JSON.stringify({ model: { display_name: "Opus" }, transcript_path: tmp });
  const r = spawnSync("node", [RUNTIME, descriptor], { input: payload, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /Opus/);
});
