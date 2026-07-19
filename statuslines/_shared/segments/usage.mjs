// usage — Claude.ai subscription rate-limit usage (5h / 7d windows), rendered
// as threshold-colored bars + percent + relative reset timers (a later pass
// dropped the "resets in" prefix):
//   Usage <bar> 37% (2h 55m) · Weekly <bar> 62% (2d 10h)
// Present only for Pro/Max subscribers after the first API response; each
// window is independently optional and read from rate_limits.{five_hour,
// seven_day}.{used_percentage,resets_at}. The reset suffix is omitted when
// `resets_at` is absent or already past (formatReset returns ""). Bars render
// even at 0% used_percentage — a stable anchor, matching context.mjs — and the
// whole segment renders null only when neither window is present. The two
// windows join with `ctx.sep` so they honor the line's
// descriptor-declared separator instead of a hardcoded dot.
import { renderBar, resolveBarColor } from "../lib/bar.mjs";

const METRIC = "usage";
const DEFAULT_COLOR = "usageBar";

function pct(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function renderWindow(ctx, label, window) {
  if (!window || typeof window !== "object") return null;
  const p = pct(window.used_percentage);
  if (p == null) return null;

  const bar = renderBar(ctx, { metric: METRIC, pct: p, defaultColor: DEFAULT_COLOR });
  const colorKey = resolveBarColor(ctx, METRIC, p, DEFAULT_COLOR);
  const pctText = ctx.color(ctx.fmt.pct(p), colorKey);

  const reset = ctx.fmt.reset(window.resets_at);
  const suffix = reset ? ` ${ctx.color(`(${reset})`, "muted")}` : "";

  return `${label} ${bar} ${pctText}${suffix}`;
}

export function render(ctx) {
  const rl = ctx.data?.rate_limits;
  if (!rl || typeof rl !== "object") return null;

  const parts = [renderWindow(ctx, "Usage", rl.five_hour), renderWindow(ctx, "Weekly", rl.seven_day)].filter(
    Boolean,
  );
  if (parts.length === 0) return null;

  return parts.join(ctx.sep);
}
