// todos — in-progress todo + done/total, enriched from the Tier-2 transcript
// when available: `▸ <in-progress> (21/39)`. Falls back to
// today's defensive stdin field when ctx.transcript is absent — no regression
// for existing hosts.
//
// HONEST GAP (stdin fallback only): the documented statusline payload has no
// todos field. We read an optional `todos` value defensively: a number (open
// count), an array, or an object {completed,total}. Renders null when absent.

function renderFromTranscript(ctx, todos) {
  if (!todos || typeof todos !== "object") return null;
  const total = Number(todos.total);
  if (!Number.isFinite(total) || total <= 0) return null;
  const done = Number(todos.done) || 0;
  const label = todos.inProgress
    ? `▸ ${ctx.sanitize(todos.inProgress)} (${done}/${total})`
    : `▸ (${done}/${total})`;
  return ctx.color(label, "muted");
}

export function render(ctx) {
  const fromTranscript = renderFromTranscript(ctx, ctx.transcript?.todos);
  if (fromTranscript != null) return fromTranscript;

  const t = ctx.data?.todos;
  if (t == null) return null;

  let label = null;
  if (typeof t === "number" && Number.isFinite(t) && t > 0) {
    label = `☐ ${t}`;
  } else if (Array.isArray(t)) {
    if (t.length === 0) return null;
    const done = t.filter((x) => x && (x.status === "completed" || x.done === true)).length;
    label = `☐ ${done}/${t.length}`;
  } else if (typeof t === "object") {
    const total = Number(t.total);
    const completed = Number(t.completed) || 0;
    if (!Number.isFinite(total) || total <= 0) return null;
    label = `☐ ${completed}/${total}`;
  }
  if (!label) return null;
  return ctx.color(label, "muted");
}
