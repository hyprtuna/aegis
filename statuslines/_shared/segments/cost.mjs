// cost — estimated session cost from cost.total_cost_usd.
// Hidden cleanly when the field is absent or unreliable (non-finite / negative).
export function render(ctx) {
  const raw = ctx.data?.cost?.total_cost_usd;
  if (raw == null) return null;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return null;
  return ctx.color(ctx.fmt.usd(v), "cost");
}
