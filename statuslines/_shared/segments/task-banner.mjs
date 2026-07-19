// task-banner — current in-progress task banner, transcript-derived.
// Surfaces the active todo item (`ctx.transcript.todos.inProgress`)
// as a short "working on X" banner. Renders null when the transcript is
// absent, gated off, parse-failed, or there is no in-progress todo.
const MAX_LEN = 60;

export function render(ctx) {
  const inProgress = ctx.transcript?.todos?.inProgress;
  if (!inProgress || typeof inProgress !== "string") return null;

  const text = ctx.sanitize(inProgress).trim();
  if (!text) return null;

  const truncated = text.length > MAX_LEN ? `${text.slice(0, MAX_LEN - 1).trimEnd()}…` : text;
  return ctx.color(`▶ ${truncated}`, "accent");
}
