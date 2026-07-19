// transcript.mjs — bounded, cached, guarded JSONL transcript reader.
//
// Ports a narrow slice of claude-hud's src/transcript.ts (tool_use/tool_result
// pairing by id, Task/Agent tool_use -> agent, TodoWrite tool_use -> todos,
// last `user` message -> prompt echo) for the statusline's Tier-2 HUD detail.
// See .aegis/specs/features/ag-0260-statusline-tier2-transcript/
// implementation-plan.md for the interface + decisions (D1 bounded+cached
// read, D2 degrade-to-null/never-throw, D6 gated pre-parse).
//
// CRITICAL (architecture): readTranscript() is SYNCHRONOUS and must be called
// exactly once per statusline invocation, from runtime.mjs's run() — never
// from inside a segment's render(). compose() calls render(ctx) synchronously
// (not awaited), so parsing here would either block every segment or race.
// See statuslines/AGENTS.md and the v0.3.6 plan's "Architecture note".
//
// Bounded read (a strict-review fix): a transcript grows every turn, so
// the mtime+size cache key misses on every turn and this function actually
// reads the file from disk each call. To keep that read inside Claude Code's
// synchronous statusline time budget, files at or under MAX_READ_BYTES (2MiB)
// are read whole (as before); files ABOVE that ceiling are read via a trailing
// window of exactly MAX_READ_BYTES bytes (openSync/readSync from
// `size - MAX_READ_BYTES`), and the first (necessarily partial) line of that
// window is dropped before parsing. This is semantically correct for a HUD:
// recent tools/agents (last-N), the latest TodoWrite, and the last user prompt
// all live at the tail. A tool_use whose tool_result falls outside the window
// simply renders as `running`; an orphan tool_result with no matching
// tool_use is silently ignored. Both are acceptable HUD approximations.
//
// Contract: readTranscript(path) -> TranscriptSummary | null.
//   TranscriptSummary = {
//     tools: [{ name, count, status: 'running'|'completed'|'error', target? }],
//       -- ordered by RECENCY, most-recently-used LAST; NOT
//          sorted by count. A consumer wanting "current activity" takes the
//          last entry rather than the highest-count ("dominant") one.
//     agents: [{ type, model?, description?, durationMs?, status: 'running'|'completed' }],
//     todos: { done, total, inProgress } | null,
//     prompt: string | null,
//       -- the last GENUINE user turn; harness envelopes (slash-command
//          invocations, `<local-command-stdout>` blocks) are skipped by
//          content shape, never echoed.
//          Currently UNCONSUMED (the prompt-echo segment that read it was
//          retired in v0.3.10) — retained here as reusable.
//   }
// Returns null on ANY failure: missing/empty path, not a string, realpath
// failure, stat failure, not a regular file, or a read error (whole-file or
// trailing-window). An individual malformed JSONL line is skipped
// (partial-parse tolerance) and never aborts the parse. This function must
// NEVER throw.
import {
  readFileSync,
  statSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  openSync,
  readSync,
  closeSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir, homedir, userInfo } from "node:os";
import { join } from "node:path";
import { sanitize } from "./sanitize.mjs";

const CACHE_VERSION = 1;
const CACHE_DIR = resolveCacheDir();
const MAX_CACHE_FILES = 64; // best-effort trim ceiling
const MAX_READ_BYTES = 2 * 1024 * 1024; // trailing-window read ceiling
const MAX_TOOLS = 20; // claude-hud cap
const MAX_AGENTS = 10; // claude-hud cap
const NAME_MAX_LEN = 64;
const TARGET_MAX_LEN = 40;
const DESCRIPTION_MAX_LEN = 120;
const TODO_MAX_LEN = 80;
const PROMPT_MAX_LEN = 240;

// resolveCacheDir() -> a per-user cache base, guarded end to end (a failure
// here must never throw — worst case we fall back to a shared tmpdir path,
// and any subsequent read/write failure against that path is separately
// swallowed by readCache()/writeCache()). Preference order:
//   1. $XDG_CACHE_HOME/aegis-statusline
//   2. <homedir>/.cache/aegis-statusline
//   3. <tmpdir>/aegis-statusline-<uid>  (homedir unusable)
//   4. <tmpdir>/aegis-statusline-shared (last-resort)
function resolveCacheDir() {
  try {
    const xdg = process.env.XDG_CACHE_HOME;
    if (typeof xdg === "string" && xdg.trim()) return join(xdg, "aegis-statusline");
  } catch {
    // env access failed -> fall through
  }
  try {
    const home = homedir();
    if (typeof home === "string" && home) return join(home, ".cache", "aegis-statusline");
  } catch {
    // homedir unusable -> fall through to a uid-scoped tmpdir
  }
  try {
    const uid = userInfo().uid;
    return join(tmpdir(), `aegis-statusline-${Number.isFinite(uid) ? uid : "shared"}`);
  } catch {
    return join(tmpdir(), "aegis-statusline-shared");
  }
}

// trimCacheDir(dir) -> best-effort: when the cache dir holds more than
// MAX_CACHE_FILES entries, delete the oldest (by mtime) until back at the
// ceiling. Wrapped end to end — a cleanup failure must never fail the
// read/parse that triggered it.
function trimCacheDir(dir) {
  try {
    const entries = readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (entries.length <= MAX_CACHE_FILES) return;
    const withStats = [];
    for (const f of entries) {
      try {
        const p = join(dir, f);
        withStats.push({ p, mtimeMs: statSync(p).mtimeMs });
      } catch {
        // stat failure on one entry -> skip it, keep trimming the rest
      }
    }
    withStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const excess = withStats.length - MAX_CACHE_FILES;
    for (let i = 0; i < excess; i += 1) {
      try {
        unlinkSync(withStats[i].p);
      } catch {
        // best-effort delete -> ignore individual failures
      }
    }
  } catch {
    // cache dir unreadable/missing -> nothing to trim
  }
}

// Test-only injection point for the whole-file read, so tests can spy on/
// count calls without monkeypatching node:fs (named ESM imports are live
// bindings but not reassignable from outside the module). Defaults to the
// real readFileSync; never used for the cache file itself.
let readTranscriptFile = readFileSync;
export function _setReadImplForTests(fn) {
  readTranscriptFile = typeof fn === "function" ? fn : readFileSync;
}

// Test-only injection point for the trailing-window read, mirroring
// _setReadImplForTests above. Defaults to the real openSync/readSync/closeSync
// implementation; never used for the cache file itself.
let readTranscriptTail = defaultReadTail;
export function _setReadTailImplForTests(fn) {
  readTranscriptTail = typeof fn === "function" ? fn : defaultReadTail;
}

// defaultReadTail(path, size, maxBytes) -> the trailing `min(maxBytes, size)`
// bytes of the file at `path`, decoded as utf8. Synchronous; any failure
// (open/read) propagates to the caller's try/catch — readTranscript() treats
// it exactly like a whole-file read failure (returns null).
function defaultReadTail(path, size, maxBytes) {
  const length = Math.min(maxBytes, size);
  const position = size - length;
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");
  let read = 0;
  try {
    // Capture the actual byte count: readSync may short-read, and Buffer.alloc
    // zero-fills, so decoding the whole buffer would append NUL padding that
    // corrupts the newest (tail) lines. Decode only the bytes actually read.
    read = readSync(fd, buffer, 0, length, position);
  } finally {
    closeSync(fd);
  }
  return buffer.toString("utf8", 0, read);
}

function cachePathFor(realPath) {
  const hash = createHash("sha256").update(realPath).digest("hex");
  return join(CACHE_DIR, `${hash}.json`);
}

function readCache(cachePath, realPath, mtimeMs, size) {
  try {
    const raw = readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.version === CACHE_VERSION &&
      parsed.path === realPath &&
      parsed.mtimeMs === mtimeMs &&
      parsed.size === size &&
      parsed.summary &&
      typeof parsed.summary === "object"
    ) {
      return parsed.summary;
    }
  } catch {
    // cache miss/corrupt/absent -> fall through to a fresh parse
  }
  return null;
}

function writeCache(cachePath, realPath, mtimeMs, size, summary) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
    const payload = JSON.stringify({ version: CACHE_VERSION, path: realPath, mtimeMs, size, summary });
    writeFileSync(cachePath, payload, { encoding: "utf8", mode: 0o600 });
    trimCacheDir(CACHE_DIR);
  } catch {
    // best-effort: a cache-write failure must never fail the read
  }
}

// extractTarget(name, input) -> a short display string for a tool_use's
// primary argument, or undefined. Ported from claude-hud's extractTarget.
function extractTarget(name, input) {
  if (!input || typeof input !== "object") return undefined;
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
      if (typeof input.file_path === "string") return input.file_path;
      if (typeof input.path === "string") return input.path;
      return undefined;
    case "Glob":
    case "Grep":
      return typeof input.pattern === "string" ? input.pattern : undefined;
    case "Bash": {
      if (typeof input.command !== "string") return undefined;
      const cmd = input.command.replace(/\s+/g, " ").trim();
      if (!cmd) return undefined;
      return cmd.length > 30 ? `${cmd.slice(0, 30).trimEnd()}...` : cmd;
    }
    default:
      return undefined;
  }
}

// parseTranscriptText(raw) -> TranscriptSummary. Never throws: each line is
// parsed in its own try/catch so one malformed line cannot abort the parse.
function parseTranscriptText(raw) {
  const tools = new Map(); // tool_use id -> { name, target, status }
  const agents = new Map(); // tool_use id -> { type, model, description, status, startMs, durationMs }
  let lastTodos = null;
  let lastPrompt = null;

  const lines = String(raw).split("\n");
  for (const line of lines) {
    if (!line || !line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== "object") continue;

      const content = entry?.message?.content;

      // Last GENUINE user-message text becomes the prompt echo. Claude Code's
      // transcript stores plain user turns as a string `content`; tool_result
      // turns are also `type: "user"` but carry an array `content` instead,
      // so this check naturally skips them. Claude Code ALSO stores
      // slash-command invocations (`<command-message>…<command-name>…`),
      // `<local-command-stdout>` blocks, background-agent completion notices
      // (`<task-notification>`), and `<system-reminder>` injections as
      // string-content `user` turns — these are NOT flagged `isMeta` (verified
      // against a live transcript), so we filter by content shape instead:
      // skip any trimmed content starting with `<command-`, `<local-command-`,
      // `<task-notification`, or `<system-reminder`.
      // We only overwrite `lastPrompt` for a surviving (genuine) turn, so an
      // envelope never clobbers the last real prompt.
      if (entry.type === "user" && typeof content === "string") {
        const trimmed = content.trim();
        // Harness envelopes ALWAYS begin with their tag (`<command-message>`,
        // `<command-name>`, `<command-args>`, `<local-command-stdout>`,
        // `<task-notification>`, `<system-reminder>`, …), so a start-of-string
        // match catches them all. We do NOT substring-match: a genuine prompt
        // that merely QUOTES such markup (e.g. a bug report about a slash
        // command) must still be echoed.
        const isHarnessEnvelope =
          trimmed.startsWith("<command-") ||
          trimmed.startsWith("<local-command-") ||
          trimmed.startsWith("<task-notification") ||
          trimmed.startsWith("<system-reminder");
        if (!isHarnessEnvelope) lastPrompt = content;
      }

      if (!Array.isArray(content)) continue;

      const ts = typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;

      for (const block of content) {
        if (!block || typeof block !== "object") continue;

        if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
          if (block.name === "Task" || block.name === "Agent") {
            const input = block.input && typeof block.input === "object" ? block.input : {};
            agents.set(block.id, {
              type: typeof input.subagent_type === "string" ? input.subagent_type : "agent",
              model: typeof input.model === "string" ? input.model : undefined,
              description: typeof input.description === "string" ? input.description : undefined,
              status: "running",
              startMs: Number.isFinite(ts) ? ts : undefined,
            });
          } else if (block.name === "TodoWrite") {
            const input = block.input && typeof block.input === "object" ? block.input : {};
            if (Array.isArray(input.todos)) lastTodos = input.todos;
          } else {
            tools.set(block.id, {
              name: block.name,
              target: extractTarget(block.name, block.input),
              status: "running",
            });
          }
        } else if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
          const tool = tools.get(block.tool_use_id);
          if (tool) tool.status = block.is_error ? "error" : "completed";

          const agent = agents.get(block.tool_use_id);
          if (agent) {
            agent.status = "completed";
            if (Number.isFinite(ts) && Number.isFinite(agent.startMs)) {
              agent.durationMs = Math.max(0, ts - agent.startMs);
            }
          }
        }
      }
    } catch {
      // malformed line -> skip it, keep parsing (partial-parse tolerance)
    }
  }

  // Cap to the last N raw events, then aggregate tools by name -> count. The
  // most recently observed status/target for a name wins (reflects the tool's
  // current activity, not its first call). The OUTPUT array is ordered by
  // recency — most-recently-used LAST — so a consumer that
  // wants "what's happening now" (tools.mjs) can just take the last entry,
  // instead of the highest-count ("dominant") one, which let one stale error
  // on a high-count tool (e.g. Bash) redden an otherwise-healthy aggregate.
  const toolEvents = Array.from(tools.values()).slice(-MAX_TOOLS);
  const toolAgg = new Map();
  const lastSeenAt = new Map(); // name -> index of its most recent occurrence
  toolEvents.forEach((t, index) => {
    const name = sanitize(t.name).slice(0, NAME_MAX_LEN);
    if (!name) return;
    const target = t.target != null ? sanitize(t.target).slice(0, TARGET_MAX_LEN) : undefined;
    const existing = toolAgg.get(name);
    if (existing) {
      existing.count += 1;
      existing.status = t.status;
      if (target != null) existing.target = target;
    } else {
      toolAgg.set(name, { name, count: 1, status: t.status, target });
    }
    lastSeenAt.set(name, index);
  });
  const toolsOut = Array.from(toolAgg.values()).sort(
    (a, b) => lastSeenAt.get(a.name) - lastSeenAt.get(b.name),
  );

  const agentEvents = Array.from(agents.values()).slice(-MAX_AGENTS);
  const agentsOut = agentEvents.map((a) => ({
    type: sanitize(a.type || "agent").slice(0, NAME_MAX_LEN) || "agent",
    model: a.model ? sanitize(a.model).slice(0, NAME_MAX_LEN) : undefined,
    description: a.description ? sanitize(a.description).slice(0, DESCRIPTION_MAX_LEN) : undefined,
    durationMs: Number.isFinite(a.durationMs) ? a.durationMs : undefined,
    status: a.status === "completed" ? "completed" : "running",
  }));

  let todosOut = null;
  if (Array.isArray(lastTodos)) {
    const total = lastTodos.length;
    const done = lastTodos.filter((t) => t && t.status === "completed").length;
    const inProgressItem = lastTodos.find((t) => t && t.status === "in_progress");
    todosOut = {
      done,
      total,
      inProgress:
        inProgressItem && typeof inProgressItem.content === "string"
          ? sanitize(inProgressItem.content).slice(0, TODO_MAX_LEN)
          : null,
    };
  }

  const promptOut = lastPrompt ? sanitize(lastPrompt).trim().slice(0, PROMPT_MAX_LEN) || null : null;

  return {
    tools: toolsOut,
    agents: agentsOut,
    todos: todosOut,
    prompt: promptOut,
  };
}

// readTranscript(path) -> TranscriptSummary | null. Synchronous, bounded,
// cached by resolved-path mtime+size (D1), and guarded end to end (D2) — this
// function never throws.
export function readTranscript(path) {
  try {
    if (!path || typeof path !== "string") return null;

    let realPath;
    try {
      realPath = realpathSync(path);
    } catch {
      return null;
    }

    let stat;
    try {
      stat = statSync(realPath);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;

    const cachePath = cachePathFor(realPath);
    const cached = readCache(cachePath, realPath, stat.mtimeMs, stat.size);
    if (cached) return cached;

    let raw;
    try {
      if (stat.size > MAX_READ_BYTES) {
        raw = readTranscriptTail(realPath, stat.size, MAX_READ_BYTES);
        // We started reading mid-file: the first line is necessarily partial
        // (or there IS no newline at all in the window) — drop it rather than
        // risk feeding a truncated JSON object into the parser.
        const firstNewline = raw.indexOf("\n");
        raw = firstNewline === -1 ? "" : raw.slice(firstNewline + 1);
      } else {
        raw = readTranscriptFile(realPath, "utf8");
      }
    } catch {
      return null;
    }

    const summary = parseTranscriptText(raw);
    writeCache(cachePath, realPath, stat.mtimeMs, stat.size, summary);
    return summary;
  } catch {
    // belt-and-braces: readTranscript must NEVER throw (D2).
    return null;
  }
}
