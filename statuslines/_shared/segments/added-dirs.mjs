// added-dirs — count of directories added via /add-dir, e.g. "+2 dirs".
export function render(ctx) {
  const dirs = ctx.data?.workspace?.added_dirs;
  if (!Array.isArray(dirs) || dirs.length === 0) return null;
  const n = dirs.length;
  return ctx.color(`+${n} dir${n === 1 ? "" : "s"}`, "muted");
}
