// context-detailed — Context label + bar + percent + UNCONDITIONAL token
// breakdown "(in: Xk, cache: Yk, out: Zk)". Reuses context.mjs's bar builder,
// its AG-0259 token-fallback percent (computeContextPct), and its AG-0262 T2
// `Context` label (contextLabel) so this segment and `context` never disagree
// on the reported label or percentage.
// Token breakdown derives from context_window.current_usage; when current_usage
// is null (pre-first-call / post-/compact) the breakdown reports 0k each rather
// than vanishing — the breakdown is unconditional by spec.
import { buildBar, computeContextPct, contextLabel, pickKey } from "./context.mjs";

export function render(ctx) {
  const cw = ctx.data?.context_window;
  if (!cw || typeof cw !== "object") return null;

  const pct = computeContextPct(cw);
  const bar = buildBar(ctx, pct);

  const u = cw.current_usage && typeof cw.current_usage === "object" ? cw.current_usage : {};
  const inTok = (Number(u.input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0);
  const cacheTok = Number(u.cache_read_input_tokens) || 0;
  const outTok = Number(u.output_tokens) || 0;

  const breakdown = ctx.color(
    `(in: ${ctx.fmt.k(inTok)}, cache: ${ctx.fmt.k(cacheTok)}, out: ${ctx.fmt.k(outTok)})`,
    "muted",
  );

  return `${contextLabel(ctx)} ${bar} ${ctx.color(ctx.fmt.pct(pct), pickKey(ctx, pct))} ${breakdown}`;
}
