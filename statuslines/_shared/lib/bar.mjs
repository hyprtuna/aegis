// bar.mjs — shared threshold-colored progress bar renderer.
//
// Extracted from context.mjs's original inline buildBar/pickKey so context.mjs
// and usage.mjs share one fill-math + color-resolution implementation. Lives
// under _shared/lib/, NOT _shared/segments/ — the runtime auto-registers every
// segments/*.mjs as a renderable segment, and a shared helper must not collide
// with that scan (see statuslines/AGENTS.md).
//
// Color resolution (decision D1): prefer the preset-declared threshold table
// via ctx.threshold(metric, pct) — the runtime's existing v0.0.14 composability
// mechanism (no new color engine). When ctx.threshold returns null (no
// `thresholds.<metric>` block in the descriptor, or no breakpoint matched),
// fall back to the caller's flat `defaultColor` theme key (e.g. `contextBar`
// for the context segment, `usageBar` for usage).
const DEFAULT_WIDTH = 10;

// resolveBarColor(ctx, metric, pct, defaultColor) -> theme color key (string).
export function resolveBarColor(ctx, metric, pct, defaultColor) {
  const hit = typeof ctx?.threshold === "function" ? ctx.threshold(metric, pct) : null;
  return hit && hit.color ? hit.color : defaultColor;
}

// renderBar(ctx, { metric, pct, width, defaultColor }) -> colored bar string.
// Fill math: clamp pct to 0-100, round the filled-cell count. Renders even at
// pct=0 (an all-empty bar) so the bar is a stable visual anchor — callers
// decide whether to render at all based on whether the underlying metric is
// present.
export function renderBar(ctx, { metric, pct, width = DEFAULT_WIDTH, defaultColor } = {}) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = Math.round((clamped * width) / 100);
  const empty = width - filled;
  const bar = ctx.bar.filled.repeat(filled) + ctx.bar.empty.repeat(empty);
  const colorKey = resolveBarColor(ctx, metric, clamped, defaultColor);
  return ctx.color(bar, colorKey);
}
