// runtime.mjs — bulletproof statusline runtime for Aegis.
//
// ──────────────────────────────────────────────────────────────────────────
// ARGV CONTRACT (what the projected per-preset .mjs must pass)
// ──────────────────────────────────────────────────────────────────────────
//   node <preset>.mjs <descriptorPath> <themeName?>
//
//   process.argv[2] = absolute path to the preset descriptor JSON
//                     (statuslines/<preset>/statusline.json). REQUIRED.
//   process.argv[3] = theme name override (optional). When omitted, the theme
//                     named in the descriptor's `theme` field is used.
//
// The projected preset launcher is expected to be a 1-line shim:
//     import { run } from "<...>/_shared/runtime.mjs";
//     run(new URL("./statusline.json", import.meta.url).pathname);
// or to invoke this file directly with argv. Both paths converge on run().
//
// ──────────────────────────────────────────────────────────────────────────
// STDIN CONTRACT
// ──────────────────────────────────────────────────────────────────────────
//   Claude Code pipes a single JSON object on stdin. See
//   references/claude-code-docs/docs/statusline.md for the authoritative shape.
//   COLUMNS / LINES may be present in process.env (Claude Code >= 2.1.153).
//
// ──────────────────────────────────────────────────────────────────────────
// ctx SHAPE passed to every segment's render(ctx)
// ──────────────────────────────────────────────────────────────────────────
//   ctx = {
//     data:    <parsed stdin JSON, never null — {} on missing>,
//     theme:   <resolved theme from loader.loadTheme()>,
//     colors:  <theme.colors map>,
//     bar:     <{filled, empty} glyphs>,
//     columns: <number, from COLUMNS env or 120>,
//     lines:   <number, from LINES env or 0 when absent>,
//     color:   (text, key) => string   // theme.colorize, color-by-theme-key
//     sanitize:(text) => string         // strip ALL C0 control chars incl. ESC and TAB, plus DEL
//     fmt:     { k, pct, usd, dur, reset } // small shared formatters
//     sep:     " <glyph> "              // resolved separator: descriptor.separator
//                 (default "·") wrapped in a space + theme-colored. compose() uses this as the
//                 line joiner; segments read it to match sub-part joins to the line's separator.
//     transcript: <TranscriptSummary | null> // Tier-2: pre-parsed
//                 once in run() (see lib/transcript.mjs), gated by
//                 descriptorNeedsTranscript(). null when absent/ungated/
//                 parse-failed. Tier-2 segments (tools/agents/todos/
//                 task-banner) read it synchronously; NEVER parsed
//                 inside a segment's render().
//   }
//
//   Each segment exports `render(ctx)` returning `string | null`.
//   null  => the segment contributes nothing (dropped before joining).
//
// ──────────────────────────────────────────────────────────────────────────
// BULLETPROOF GUARANTEES
// ──────────────────────────────────────────────────────────────────────────
//   - stdin read to completion with a 400ms timeout.
//   - JSON parse failure -> "[Aegis]" + exit 0.
//   - All rendering wrapped in try/catch; catch -> "[Aegis]".
//   - process.exit(0) ALWAYS, in a finally block.
//   - Every interpolated stdin string is sanitized (ALL C0 incl. ESC + TAB, plus DEL, stripped).
//   - Never emits a wholly empty stdout (falls back to "[Aegis]").
//   - No stderr noise.

import { loadTheme } from "./themes/loader.mjs";
import { formatReset } from "./lib/reset-time.mjs";
import { sanitize } from "./lib/sanitize.mjs";
import { readTranscript } from "./lib/transcript.mjs";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SHARED_DIR = dirname(fileURLToPath(import.meta.url));
const SEGMENTS_DIR = join(SHARED_DIR, "segments");
const FALLBACK = "[Aegis]";
const STDIN_TIMEOUT_MS = 400;

// sanitize: strip ALL C0 control chars (0x00-0x1F, including ESC 0x1B and TAB
// 0x09) and 0x7F (DEL) from untrusted stdin-derived strings. See
// lib/sanitize.mjs for the full rationale (ESC/TAB injection). Extracted there
// (extracted so lib/transcript.mjs can reuse it without a circular import back
// into this module; re-exported here so existing `import { sanitize } from
// "./runtime.mjs"` call sites (e.g. subagent-runtime.mjs) keep working.
export { sanitize };

// Tier-2 gate: the runtime only pre-parses the transcript when
// the active descriptor includes at least one transcript-derived segment, so
// non-HUD presets pay zero transcript-read cost.
const TRANSCRIPT_SEGMENT_IDS = new Set(["tools", "agents", "todos", "task-banner"]);

// descriptorNeedsTranscript(descriptor) -> boolean. Exported for direct unit
// testing of the gate condition in isolation from the stdin/child-process
// plumbing in run().
export function descriptorNeedsTranscript(descriptor) {
  if (!descriptor || !Array.isArray(descriptor.segments)) return false;
  for (const line of descriptor.segments) {
    if (!Array.isArray(line)) continue;
    for (const id of line) {
      if (TRANSCRIPT_SEGMENT_IDS.has(id)) return true;
    }
  }
  return false;
}

// ── shared formatters ──────────────────────────────────────────────────────
const fmt = {
  // tokens -> "Xk" (rounded), e.g. 15500 -> "16k", < 1000 -> raw
  k(n) {
    const v = Number(n) || 0;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  },
  pct(n) {
    return `${Math.round(Number(n) || 0)}%`;
  },
  usd(n) {
    return `$${(Number(n) || 0).toFixed(2)}`;
  },
  // ms -> "Xm Ys"
  dur(ms) {
    const sec = Math.floor((Number(ms) || 0) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  },
  // epoch (s or ms, unit auto-detected) -> relative reset string, "" when
  // absent/past/NaN. Delegates to lib/reset-time.mjs.
  reset(resetAt) {
    return formatReset(resetAt);
  },
};

// ── read stdin to completion with a hard timeout ────────────────────────────
function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(buf);
    };
    const timer = setTimeout(finish, STDIN_TIMEOUT_MS);
    if (timer.unref) timer.unref();
    try {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => {
        buf += c;
      });
      process.stdin.on("end", () => {
        clearTimeout(timer);
        finish();
      });
      process.stdin.on("error", () => {
        clearTimeout(timer);
        finish();
      });
      process.stdin.resume();
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

// ── lazily load every segment module once ───────────────────────────────────
let SEGMENT_CACHE = null;
async function loadSegments() {
  if (SEGMENT_CACHE) return SEGMENT_CACHE;
  const map = new Map();
  let files = [];
  try {
    files = readdirSync(SEGMENTS_DIR).filter((f) => f.endsWith(".mjs"));
  } catch {
    files = [];
  }
  for (const f of files) {
    const id = f.replace(/\.mjs$/, "");
    try {
      const mod = await import(new URL(`./segments/${f}`, import.meta.url));
      if (typeof mod.render === "function") map.set(id, mod.render);
    } catch {
      // a broken segment must never take down the whole statusline
    }
  }
  SEGMENT_CACHE = map;
  return map;
}

function resolveColumns() {
  const c = parseInt(process.env.COLUMNS ?? "", 10);
  return Number.isFinite(c) && c > 0 ? c : 120;
}
function resolveLines() {
  const l = parseInt(process.env.LINES ?? "", 10);
  return Number.isFinite(l) && l > 0 ? l : 0;
}

// ── composability helpers (v0.0.14) ─────────────────────────────────────────
// All optional + additive: a descriptor that declares none of these behaves
// exactly as before.

// i18n: return a translator t(key) -> labels[key] || key. No descriptor.i18n =>
// identity (label keys pass through unchanged).
function makeTranslator(descriptor) {
  const labels =
    descriptor && descriptor.i18n && descriptor.i18n.labels && typeof descriptor.i18n.labels === "object"
      ? descriptor.i18n.labels
      : null;
  return (key) => {
    if (labels && Object.prototype.hasOwnProperty.call(labels, key) && typeof labels[key] === "string") {
      return labels[key];
    }
    return String(key);
  };
}

// Threshold escalation: resolve a metric value to { color, label } from the
// descriptor's ordered breakpoints (FIRST `at` <= value wins; list is authored
// high→low). Returns null when no metric/breakpoint matches — the segment then
// keeps its default color. Segments opt in by calling ctx.threshold(metric, value).
function makeThresholdResolver(descriptor) {
  const table =
    descriptor && descriptor.thresholds && typeof descriptor.thresholds === "object" ? descriptor.thresholds : null;
  return (metric, value) => {
    if (!table) return null;
    const breaks = table[metric];
    if (!Array.isArray(breaks)) return null;
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    for (const b of breaks) {
      if (b && typeof b === "object" && typeof b.at === "number" && v >= b.at) {
        return { color: String(b.color), label: b.label != null ? String(b.label) : null };
      }
    }
    return null;
  };
}

// Stable reordering of a single line's segment IDs by descriptor.order. Segments
// listed in `order` sort by their index there; segments NOT listed keep their
// authored relative position and sort AFTER all listed ones. No add/remove.
function applyOrder(lineSpec, order) {
  if (!Array.isArray(order) || order.length === 0) return lineSpec;
  const rank = new Map();
  order.forEach((id, i) => rank.set(id, i));
  const LISTED_BIAS = 0;
  const UNLISTED_BIAS = order.length;
  return lineSpec
    .map((id, idx) => ({
      id,
      idx,
      key: rank.has(id) ? LISTED_BIAS + rank.get(id) : UNLISTED_BIAS + idx,
    }))
    .sort((a, b) => a.key - b.key || a.idx - b.idx)
    .map((e) => e.id);
}

// ── build the ctx object handed to each segment ─────────────────────────────
// `transcript` is the pre-parsed TranscriptSummary from run(), or
// null when absent/gated-off/parse-failed. Tier-2 segments read it
// synchronously via ctx.transcript; it is never fetched inside a segment.
export function buildCtx(data, theme, descriptor = {}, transcript = null) {
  return {
    data: data && typeof data === "object" ? data : {},
    theme,
    colors: theme.colors,
    bar: theme.bar,
    columns: resolveColumns(),
    lines: resolveLines(),
    color: theme.colorize,
    sanitize,
    fmt,
    transcript: transcript && typeof transcript === "object" ? transcript : null,
    // v0.0.14 composability — always present, no-op when the descriptor omits them.
    t: makeTranslator(descriptor),
    threshold: makeThresholdResolver(descriptor),
    // The resolved inter-segment separator (glyph wrapped in a single
    // space on each side, theme-colored). compose() uses this as the line
    // joiner; segments (e.g. usage.mjs) read it to match the line's joiner
    // between their own sub-parts. Defaults to the pre-existing " · ".
    sep: ` ${theme.colorize(String(descriptor?.separator ?? "·"), "separator")} `,
  };
}

// ── compose all lines from a descriptor + ctx into final stdout text ────────
export async function compose(descriptor, ctx) {
  const segments = await loadSegments();
  const sep = ctx.sep;
  const lineSpecs = Array.isArray(descriptor.segments) ? descriptor.segments : [];

  // v0.0.14 composability inputs (all optional; absent => legacy behavior).
  const order = Array.isArray(descriptor.order) ? descriptor.order : null;
  const mergeSep =
    typeof descriptor.mergeSeparator === "string" ? descriptor.mergeSeparator : "";
  // Map each segment ID to its merge-group index (a segment is in at most one
  // group; the first group that claims it wins). Segments in the same group that
  // end up ADJACENT after rendering are joined by `mergeSep` instead of `sep`.
  const groupOf = new Map();
  if (Array.isArray(descriptor.mergeGroups)) {
    descriptor.mergeGroups.forEach((grp, gi) => {
      if (!Array.isArray(grp)) return;
      for (const id of grp) if (!groupOf.has(id)) groupOf.set(id, gi);
    });
  }

  const renderedLines = [];
  for (const rawLine of lineSpecs) {
    if (!Array.isArray(rawLine)) continue;
    const lineSpec = order ? applyOrder(rawLine, order) : rawLine;

    // Render each segment, keeping its ID so we can decide the joiner per gap.
    const rendered = []; // { id, text }
    for (const id of lineSpec) {
      const render = segments.get(id);
      if (!render) continue;
      let out;
      try {
        out = render(ctx);
      } catch {
        out = null; // one bad segment never breaks the line
      }
      if (out != null && String(out).length > 0) rendered.push({ id, text: String(out) });
    }
    if (rendered.length === 0) continue;

    // Join: between two adjacent rendered segments, use `mergeSep` when BOTH are
    // in the same merge group, otherwise the normal `sep`.
    let lineText = rendered[0].text;
    for (let i = 1; i < rendered.length; i++) {
      const prev = rendered[i - 1].id;
      const cur = rendered[i].id;
      const sameGroup =
        groupOf.has(prev) && groupOf.has(cur) && groupOf.get(prev) === groupOf.get(cur);
      lineText += (sameGroup ? mergeSep : sep) + rendered[i].text;
    }
    renderedLines.push(lineText);
  }

  const text = renderedLines.join("\n");
  return text.length > 0 ? text : FALLBACK;
}

// ── entry point ─────────────────────────────────────────────────────────────
// run(descriptorPath?, themeOverride?) — args default to argv[2]/argv[3].
export async function run(descriptorPath = process.argv[2], themeOverride = process.argv[3]) {
  let output = FALLBACK;
  try {
    const raw = await readStdin();
    let data;
    try {
      data = raw && raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch {
      // malformed JSON on stdin -> safe fallback, exit clean
      process.stdout.write(`${FALLBACK}\n`);
      return;
    }

    let descriptor = { segments: [["model"]], theme: "mono" };
    if (descriptorPath) {
      try {
        const { readFileSync } = await import("node:fs");
        descriptor = JSON.parse(readFileSync(descriptorPath, "utf8"));
      } catch {
        // missing/unreadable descriptor -> minimal default already set
      }
    }

    const themeName = themeOverride || descriptor.theme || "mono";
    const theme = loadTheme(themeName);

    // Tier-2: pre-parse the transcript ONCE, here — never inside a
    // segment's render() (compose() calls render synchronously). Gated (D6):
    // only when a transcript_path is present AND the descriptor actually
    // wants transcript detail. This whole step is inside run()'s top-level
    // try/catch, so a bug here can never blank the bar beyond "[Aegis]"; the
    // inner try/catch additionally keeps a transcript failure from ever
    // preventing the rest of the segments from composing.
    let transcript = null;
    try {
      const transcriptPath = typeof data?.transcript_path === "string" ? data.transcript_path : null;
      if (transcriptPath && descriptorNeedsTranscript(descriptor)) {
        transcript = readTranscript(transcriptPath);
      }
    } catch {
      transcript = null;
    }

    const ctx = buildCtx(data, theme, descriptor, transcript);
    output = await compose(descriptor, ctx);
  } catch {
    output = FALLBACK;
  } finally {
    try {
      const safe = output && String(output).length > 0 ? String(output) : FALLBACK;
      process.stdout.write(`${safe}\n`);
    } catch {
      // last-resort: nothing more we can do
    }
    process.exit(0);
  }
}

// Auto-run when invoked directly (not when imported by tests).
const invokedDirectly = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();
if (invokedDirectly) run();

export { fmt, FALLBACK, loadSegments };
