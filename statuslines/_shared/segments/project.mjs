// project — basename of the current working directory.
function basename(p) {
  const parts = String(p).replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function render(ctx) {
  const dir = ctx.data?.workspace?.current_dir || ctx.data?.cwd;
  if (!dir) return null;
  return ctx.color(ctx.sanitize(basename(dir)), "project");
}
