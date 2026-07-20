// hook-projection.mjs — shared Claude hooks-block generator.
//
// The single source of truth for building the .claude-plugin/plugin.json `hooks`
// object from canonical hook intents. Both the projector (scripts/project.mjs)
// and the HOOK_INTENT drift check (scripts/validate/hook-intent.mjs) import this
// — there is NO mirror. If projection and validation could ever disagree, they
// can't anymore: they call the same function.
//
// Pure, stdlib-free, no I/O. Node 20+ ESM.

// Canonical event lifecycle order. Output is grouped by x-claude.event and
// emitted in this order so the block is stable regardless of intent-name sort.
// Events not in this list append after, in first-seen order.
export const EVENT_ORDER = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PreCompact",
  "PostCompact",
  "InstructionsLoaded",
  "FileChanged",
  "CwdChanged",
];

// Map a single intent's x-claude binding to its plugin.json dispatch object (D4):
//   command → { type:"command", command:"${CLAUDE_PLUGIN_ROOT}/<path>" }
//   prompt  → { type:"prompt", prompt[, model] }
//   agent   → { type:"agent",  prompt[, model] }
// Throws on an unknown dispatch (loud failure; the validator's schema check would
// have caught it first, but this keeps the function honest if called directly).
export function dispatchObjectFor(intent) {
  const xc = intent["x-claude"];
  if (xc.dispatch === "command") {
    return { type: "command", command: `\${CLAUDE_PLUGIN_ROOT}/${xc.command}` };
  }
  if (xc.dispatch === "prompt") {
    const o = { type: "prompt", prompt: xc.prompt };
    if (xc.model) o.model = xc.model;
    return o;
  }
  if (xc.dispatch === "agent") {
    const o = { type: "agent", prompt: xc.prompt };
    if (xc.model) o.model = xc.model;
    return o;
  }
  throw new Error(`hook ${intent.name}: unknown x-claude.dispatch "${xc.dispatch}"`);
}

// Build the plugin.json `hooks` object from canonical intents, grouped by
// x-claude.event. Intents are name-sorted first for determinism, then grouped
// by event and emitted in EVENT_ORDER. Each entry is
// { matcher?, hooks: [ <dispatch object> ] } (matcher-first key order to match
// the previously hand-maintained block). A hook either ships (appears here) or
// is deleted from hooks/ — there is no disabled/parked state.
export function generateClaudeHooksBlock(intents) {
  const claudeIntents = intents
    .filter((i) => Array.isArray(i.platforms) && i.platforms.includes("claude"))
    .filter((i) => i["x-claude"])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const byEvent = new Map();
  for (const intent of claudeIntents) {
    const xc = intent["x-claude"];
    const event = xc.event;
    if (!byEvent.has(event)) byEvent.set(event, []);
    const dispatchObj = dispatchObjectFor(intent);
    const entry = xc.matcher ? { matcher: xc.matcher, hooks: [dispatchObj] } : { hooks: [dispatchObj] };
    byEvent.get(event).push(entry);
  }

  const out = {};
  const seen = new Set();
  for (const event of EVENT_ORDER) {
    if (byEvent.has(event)) { out[event] = byEvent.get(event); seen.add(event); }
  }
  for (const [event, entries] of byEvent) {
    if (!seen.has(event)) out[event] = entries;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared-helper naming convention for the Claude hook implementation tree.
//
// A `_`-prefixed entry under .claude-plugin/hooks/ is a library sourced by hook
// scripts (`source "$(dirname "$0")/_lib.sh"`), not a hook: nothing binds it via
// x-claude.command by design. Both the projector's orphan prune and the
// HOOK_INTENT orphan rule must skip exactly the same set — if they disagreed, one
// would delete a file the other demands, or demand a file the other deleted.
//
// Same no-mirror rule as generateClaudeHooksBlock above: one predicate, two
// callers. A comment in each file asserting the other agrees is not a mechanism.
export const HOOK_HELPER_PREFIX = "_";

export function isHookHelper(entry) {
  return typeof entry === "string" && entry.startsWith(HOOK_HELPER_PREFIX);
}
