// effort — reasoning-effort level (low|medium|high|xhigh|max) when present.
// Absent when the model does not support the effort parameter → render null.
export function render(ctx) {
  const level = ctx.data?.effort?.level;
  if (!level) return null;
  return ctx.color(`◆ ${ctx.sanitize(level)}`, "accent");
}
