// model — current model display name, e.g. "[Opus]".
export function render(ctx) {
  const name = ctx.data?.model?.display_name;
  if (!name) return null;
  return ctx.color(`[${ctx.sanitize(name)}]`, "model");
}
