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
// The keep-set for the Claude hook implementation tree (.claude-plugin/hooks/).
//
// A file belongs in that tree for exactly two reasons, and both are DECLARED:
//   1. an intent binds it via x-claude.command (it is a hook), or
//   2. an intent declares it in x-claude.helpers (it is a library that hook
//      sources, e.g. `source "$(dirname "$0")/lib.sh"`).
//
// Everything else is an orphan. This replaces an earlier `_`-prefix naming
// convention, which protected a file by how it was spelled rather than by any
// claim: a maintainer who named a shared library `lib.sh` instead of `_lib.sh`
// had it deleted on the next projector run, and every hook sourcing it broke at
// runtime for every user. A declaration is checkable; a spelling is not.
//
// This function is the SINGLE source of the keep-set — the projector's
// destructive prune (scripts/project.mjs) and the HOOK_INTENT orphan rule
// (scripts/validate/hook-intent.mjs) both call it, exactly as they both call
// generateClaudeHooksBlock above. There is no mirror: if they could disagree,
// one would delete a file the other demands, or demand a file the other already
// deleted. A comment in each file asserting the other agrees is not a mechanism.
//
// Entries are BASENAMES. Both trees are flat by contract, and both callers
// compare against a directory listing.
export function hookTreeKeepSet(intents) {
  const keep = new Set();
  for (const intent of intents ?? []) {
    const xc = intent["x-claude"];
    if (!xc || typeof xc !== "object") continue;
    if (xc.dispatch === "command" && typeof xc.command === "string" && xc.command) {
      keep.add(xc.command.split("/").pop());
    }
    if (Array.isArray(xc.helpers)) {
      for (const helper of xc.helpers) {
        if (typeof helper === "string" && helper) keep.add(helper.split("/").pop());
      }
    }
  }
  return keep;
}
