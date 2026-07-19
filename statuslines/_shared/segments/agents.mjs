// agents — ALL relevant sub-agent activity, one per line, enriched from the
// Tier-2 transcript when available (claude-hud parity): running
// agents plus the last 2 completed, capped at 3 with running agents
// prioritized and never dropped for completed ones, each rendered on its OWN
// line via `\n`. Falls back to today's stdin `agent.name` field (--agent /
// agent settings) when ctx.transcript is absent — no regression for existing
// hosts.
//
// Supersedes the earlier single-most-recent-agent model: that model rendered
// exactly one line (the last agent touched); claude-hud's dense HUD shows the
// whole in-flight + recently-finished picture instead.
//
// IMPORTANT: this segment's composed string intentionally contains `\n`.
// runtime.mjs's compose() does NOT sanitize the already-rendered segment
// output (only raw stdin-derived fields are sanitized, individually, via
// ctx.sanitize below), so the newlines survive to produce one visual line per
// agent in the final statusline. Do not run the whole label through a
// control-char stripper — that would strip the very newlines this segment
// relies on.
//
// HONEST GAP (stdin fallback only): active agent name, from agent.name.
// Present only when running with --agent or agent settings configured.
// Renders null otherwise.
const MAX_RECENT_COMPLETED = 2;
const MAX_AGENTS_SHOWN = 3;

// formatDuration(ms) -> "Xs" or "Xm Ys" (compact, no leading zero minutes),
// null when ms is missing/invalid. Distinct from ctx.fmt.dur, which always
// includes the minutes component (e.g. "0m 2s") — the HUD wants "2s" alone.
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatAgent(ctx, a) {
  const icon = a.status === "completed" ? "✓" : "◐";
  let label = `${icon} ${ctx.sanitize(a.type)}`;
  if (a.model) label += ` [${ctx.sanitize(a.model)}]`;
  if (a.description) label += `: ${ctx.sanitize(a.description)}`;
  const dur = formatDuration(a.durationMs);
  if (dur) label += ` (${dur})`;

  const colorKey = a.status === "completed" ? "muted" : "accent";
  return ctx.color(label, colorKey);
}

function renderFromTranscript(ctx, agents) {
  if (!Array.isArray(agents) || agents.length === 0) return null;

  const running = agents.filter((a) => a && a.status === "running" && a.type);
  const recentCompleted = agents
    .filter((a) => a && a.status === "completed" && a.type)
    .slice(-MAX_RECENT_COMPLETED);

  // Running agents are prioritized and never dropped for completed ones: cap
  // by taking from the FRONT of `[...running, ...recentCompleted]` (running
  // first, then completed) instead of the tail, so a busy session with
  // multiple in-flight agents doesn't lose them to the completed backlog.
  const toShow = [...running, ...recentCompleted].slice(0, MAX_AGENTS_SHOWN);

  if (toShow.length === 0) return null;
  return toShow.map((a) => formatAgent(ctx, a)).join("\n");
}

export function render(ctx) {
  const fromTranscript = renderFromTranscript(ctx, ctx.transcript?.agents);
  if (fromTranscript != null) return fromTranscript;

  const name = ctx.data?.agent?.name;
  if (!name) return null;
  return ctx.color(`@${ctx.sanitize(name)}`, "accent");
}
