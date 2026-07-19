// tools — ALL relevant tool activity, enriched from the Tier-2 transcript when
// available (claude-hud parity): running tools first (`◐ <name>`,
// last 2), then completed/error tools sorted by count DESC (top 4, `<icon>
// <name> ×<count>`), then a `+N more` overflow marker. Falls back to today's
// defensive stdin field when ctx.transcript is absent (parse gated off, parse
// failed, or the host never surfaces a transcript_path) — no regression for
// existing hosts.
//
// Supersedes the earlier "most-recent activity, not dominant-by-count" model:
// that model showed exactly one tool (the most-recently-touched), which lost
// the "what else has been happening" picture claude-hud's dense HUD provides.
// Per-entry status/color is preserved from that change — a stale error on one
// tool only reddens ITS OWN entry, never the aggregate — this segment just now
// renders MULTIPLE entries side by side instead of picking a single winner.
//
// HONEST GAP (stdin fallback only): the documented statusline payload has no
// tools field. We read an optional `tools` value defensively: a number
// (count) or an array (length). Renders null when absent so presets that
// include it degrade silently on hosts that never provide it.
const STATUS_ICON = { completed: "✓", running: "◐", error: "✗" };
const STATUS_COLOR = { completed: "muted", running: "warning", error: "critical" };
const MCP_TOOL_NAME_PATTERN = /^mcp__.+__.+$/;
const MAX_RUNNING = 2;
const MAX_COMPLETED = 4;
const FALLBACK_SEP = " | ";

// shortenToolName(name) -> the display name for a tool. MCP tool names are
// namespaced as `mcp__<server>__<tool>`; claude-hud shortens these to just the
// trailing `<tool>` segment so the HUD doesn't waste width on the server
// prefix. Non-MCP names pass through unchanged.
function shortenToolName(name) {
  if (!MCP_TOOL_NAME_PATTERN.test(name)) return name;
  const parts = name.split("__");
  return parts[parts.length - 1] || name;
}

function renderFromTranscript(ctx, tools) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  const sep = typeof ctx.sep === "string" && ctx.sep.length > 0 ? ctx.sep : FALLBACK_SEP;
  const parts = [];

  // Running tools first: last 2 (recency-ordered array, so tail = most recent).
  const running = tools.filter((t) => t && t.status === "running" && t.name);
  for (const t of running.slice(-MAX_RUNNING)) {
    const name = shortenToolName(ctx.sanitize(t.name));
    parts.push(ctx.color(`${STATUS_ICON.running} ${name}`, STATUS_COLOR.running));
  }

  // Then completed/error, sorted by count DESC, top MAX_COMPLETED, with a
  // "+N more" overflow marker. Each entry keeps its OWN status color, so a
  // single stale error only reddens its own tool.
  const completed = tools.filter((t) => t && (t.status === "completed" || t.status === "error") && t.name);
  const sorted = completed.slice().sort((a, b) => (b.count || 0) - (a.count || 0));
  const visible = sorted.slice(0, MAX_COMPLETED);
  for (const t of visible) {
    const name = shortenToolName(ctx.sanitize(t.name));
    const icon = STATUS_ICON[t.status] || STATUS_ICON.completed;
    const colorKey = STATUS_COLOR[t.status] || STATUS_COLOR.completed;
    const n = Number.isFinite(t.count) ? t.count : 1;
    parts.push(ctx.color(`${icon} ${name} ×${n}`, colorKey));
  }

  const hidden = sorted.length - visible.length;
  if (hidden > 0) parts.push(ctx.color(`+${hidden} more`, "muted"));

  if (parts.length === 0) return null;
  return parts.join(sep);
}

export function render(ctx) {
  const fromTranscript = renderFromTranscript(ctx, ctx.transcript?.tools);
  if (fromTranscript != null) return fromTranscript;

  const t = ctx.data?.tools;
  let count = null;
  if (Array.isArray(t)) count = t.length;
  else if (typeof t === "number" && Number.isFinite(t)) count = t;
  if (count == null || count <= 0) return null;
  return ctx.color(`⚒ ${count}`, "muted");
}
