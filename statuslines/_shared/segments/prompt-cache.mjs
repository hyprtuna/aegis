// prompt-cache — TTL countdown until the prompt cache expires, if present.
//
// HONEST GAP: Claude Code's documented statusline payload (statusline.md as of
// this writing) does NOT expose a prompt-cache TTL or expiry timestamp. The
// `current_usage.cache_*` fields report token counts, not a clock. We therefore
// read an optional `prompt_cache.expires_at` (Unix epoch seconds) defensively
// so that if/when Claude Code surfaces it, this segment lights up with no code
// change. Until then it renders null. This gap is also recorded in
// adapters/claude-code/projection.md by the projector.
export function render(ctx) {
  const pc = ctx.data?.prompt_cache;
  const expiresAt = pc && typeof pc === "object" ? Number(pc.expires_at) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;

  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;
  if (remaining <= 0) return null;

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const label = m > 0 ? `${m}m ${s}s` : `${s}s`;
  return ctx.color(`cache ${label}`, "muted");
}
