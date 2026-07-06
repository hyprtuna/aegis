// subagent-primitives.mjs — shared validation+coercion for the four native
// plugin-subagent execution-profile fields (AG-0263 D-01): effort, isolation,
// maxTurns, background. Extracted from project.mjs's flattenXClaude() so the
// logic is testable against the REAL parser-typed (string) inputs instead of
// tautological local copies fed native literals (strict-review MEDIUM-1/HIGH).
//
// `parseFrontmatter` in project.mjs stores nested `x-claude` scalars as
// STRINGS (no coercion) — `maxTurns: 10` arrives as "10", `background: true`
// arrives as "true". validateSubagentPrimitive() accepts BOTH the string form
// the parser produces AND native types, and returns the COERCED value (a
// number for maxTurns, a boolean for background) rather than the raw input.
//
// Node stdlib, ESM, no deps.

export const SUBAGENT_PRIMITIVE_KEYS = new Set(["effort", "isolation", "maxTurns", "background"]);

// Validate + coerce a single x-claude subagent-primitive value. Returns the
// coerced value on success; throws an Error with a descriptive message on an
// invalid value. Keys outside SUBAGENT_PRIMITIVE_KEYS pass through unchanged.
export function validateSubagentPrimitive(k, v) {
  if (k === "effort") {
    if (!["low", "medium", "high"].includes(v)) {
      throw new Error(`x-claude.effort '${v}' is invalid. Must be one of: low, medium, high.`);
    }
    return v;
  }
  if (k === "isolation") {
    if (v !== "worktree") {
      throw new Error(`x-claude.isolation '${v}' is invalid. Only 'worktree' is supported.`);
    }
    return v;
  }
  if (k === "maxTurns") {
    const n = typeof v === "number" ? v : Number(v);
    if (!(Number.isInteger(n) && n > 0)) {
      throw new Error(`x-claude.maxTurns '${v}' is invalid. Must be a positive integer.`);
    }
    return n;
  }
  if (k === "background") {
    if (v === true || v === "true") return true;
    if (v === false || v === "false") return false;
    throw new Error(`x-claude.background '${v}' is invalid. Must be a boolean.`);
  }
  return v;
}

// Isolation guard (MEDIUM-2, mirrors the memory guard): `isolation: worktree`
// is pointless for a read-only agent — a worktree with no write capability can
// never be used. Throws when the agent cannot write; no-op otherwise.
//
// Reads the ALLOW-list (`tools` must include Edit/Write) — intentionally NOT the
// deny-list the memory guard reads. The semantics differ: memory AUTO-enables
// write so its guard checks nothing DENIED it, whereas isolation asks "can this
// agent write AT ALL". Every Aegis agent declares explicit bucket-expanded
// `tools` in manifest/permissions.json (no tool inheritance), so the allow-list
// read is exact here; if tool inheritance ever becomes a pattern, revisit.
export function assertIsolationWritable(name, tools) {
  const t = tools ?? [];
  if (!(t.includes("Edit") || t.includes("Write"))) {
    throw new Error(
      `agents/${name}.md: x-claude.isolation: worktree requires Edit or Write in the ` +
        `agent's tools (worktree isolation is pointless for a read-only agent), but ` +
        `manifest/permissions.json tools are [${t.join(", ")}]. Remove the isolation ` +
        `declaration or grant write access.`,
    );
  }
}
