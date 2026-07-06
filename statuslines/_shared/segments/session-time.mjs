// session-time — wall-clock session duration from cost.total_duration_ms.
// Renders null when absent.
export function render(ctx) {
  const ms = ctx.data?.cost?.total_duration_ms;
  if (ms == null) return null;
  const v = Number(ms);
  if (!Number.isFinite(v) || v < 0) return null;
  return ctx.color(`⏱ ${ctx.fmt.dur(v)}`, "muted");
}
