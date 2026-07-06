// reset-time.mjs — relative-time formatter for rate-limit reset timestamps
// (AG-0259, decisions D3/D4).
//
// Ports claude-hud's epoch-unit heuristic (references/claude-hud/src/
// external-usage.ts `parseDateValue`: a value > 1e12 is already milliseconds,
// otherwise it's seconds and gets multiplied by 1000) and the relative branch
// of `formatResetTime` (references/claude-hud/src/render/format-reset-time.ts).
// Relative-only for v0.3.6 (D3) — absolute/`both` modes are a later
// composability add if requested.
//
// Returns "" whenever the value is absent, non-finite, NaN, <= 0, or already
// in the past — never throws, per the bulletproof-runtime mandate.

// parseResetMs(value) -> epoch milliseconds, or null when unparseable/invalid.
function parseResetMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const millis = n > 1e12 ? n : n * 1000;
  return Number.isFinite(millis) ? millis : null;
}

// formatReset(resetAt, now?) -> relative string ("45m", "2h 55m", "2d 10h"),
// or "" when absent/NaN/past. `now` defaults to Date.now() (injectable for tests).
export function formatReset(resetAt, now = Date.now()) {
  const ms = parseResetMs(resetAt);
  if (ms == null) return "";

  const diffMs = ms - now;
  if (diffMs <= 0) return "";

  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
