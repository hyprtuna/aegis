// context — context-window usage: a leading label + progress bar + percent.
// Prefers the stdin-reported context_window.used_percentage; when it's
// absent, falls back to a token-based percentage — (input + cache tokens) /
// context_window_size, per claude-hud's getContextPercent fallback.
// Threshold-colored via the shared bar renderer (lib/bar.mjs):
// >=90 critical, >=70 warning when a preset declares `thresholds.context`,
// else the theme's flat `contextBar` key. Renders even at 0% so the bar is a
// stable anchor; only renders null when context_window is wholly absent (no
// usage signal at all).
//
// Label: prepends `Context` so the segment reads
// `Context <bar> <pct>`, matching usage.mjs's `Usage`/`Weekly` labels. Routed
// through ctx.t("context") for i18n (default "Context" when the descriptor
// declares no override — ctx.t falls back to the raw key itself, so we swap
// in the capitalized default ourselves). Rendered PLAIN (uncolored), matching
// usage.mjs's own label treatment — not the bar's threshold color.
import { renderBar, resolveBarColor } from "../lib/bar.mjs";

const METRIC = "context";
const DEFAULT_COLOR = "contextBar";
const LABEL_KEY = "context";
const LABEL_DEFAULT = "Context";

// contextLabel(ctx) -> the i18n-routed "Context" label (or its override),
// shared with context-detailed.mjs so both segments never disagree.
export function contextLabel(ctx) {
  const t = ctx.t(LABEL_KEY);
  return t === LABEL_KEY ? LABEL_DEFAULT : t;
}

// computeContextPct(cw) -> 0-100 integer. `cw` is the (non-null, object)
// context_window field.
export function computeContextPct(cw) {
  if (cw.used_percentage != null) {
    const v = Number(cw.used_percentage);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
  }
  const size = Number(cw.context_window_size);
  const u = cw.current_usage && typeof cw.current_usage === "object" ? cw.current_usage : null;
  if (!u || !Number.isFinite(size) || size <= 0) return 0;
  const used =
    (Number(u.input_tokens) || 0) +
    (Number(u.cache_read_input_tokens) || 0) +
    (Number(u.cache_creation_input_tokens) || 0);
  return Math.max(0, Math.min(100, Math.round((used / size) * 100)));
}

// pickKey(ctx, pct) -> theme color key, threshold-first then `contextBar`.
export function pickKey(ctx, pct) {
  return resolveBarColor(ctx, METRIC, pct, DEFAULT_COLOR);
}

export function buildBar(ctx, pct) {
  return renderBar(ctx, { metric: METRIC, pct, defaultColor: DEFAULT_COLOR });
}

export function render(ctx) {
  const cw = ctx.data?.context_window;
  if (!cw || typeof cw !== "object") return null;
  const pct = computeContextPct(cw);
  const bar = buildBar(ctx, pct);
  return `${contextLabel(ctx)} ${bar} ${ctx.color(ctx.fmt.pct(pct), pickKey(ctx, pct))}`;
}
