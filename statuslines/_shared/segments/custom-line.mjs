// custom-line — free-form passthrough segment. Renders the custom session
// label when one is set: prefers session_name (set via --name / /rename), then
// the active output_style.name. Renders null when neither is present.
//
// Presets use this as an escape hatch for "show whatever the session is named".
export function render(ctx) {
  const d = ctx.data || {};
  const text = d.session_name || d.output_style?.name;
  if (!text) return null;
  return ctx.color(ctx.sanitize(text), "label");
}
