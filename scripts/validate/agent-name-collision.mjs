// agent-name-collision.mjs — A4: cross-surface name-collision check.
//
// Uses scripts/lib/collision-names.mjs. Warns on any name claimed by more than
// one surface across skills/agents/commands, or duplicated within one kind.
//
// On the plan's "warn when an agent name lacks the <plugin>-<agent> prefix":
// canonical agent names intentionally carry NO `aegis-` prefix — the prefix is
// added at projection time. A per-agent prefix warning would therefore fire on
// every one of the 18 agents (pure noise). DECISION: we do NOT emit a per-agent
// prefix warning. Collisions are the real signal this rule exists to surface.
// We also omit the optional one-line "canonical agents carry no prefix"
// informational note — it adds noise without actionable value, and this comment
// documents the convention for maintainers. Warn-only.
//
// Note: findNameCollisions() does its own reads rather than going through
// ctx.read. The surface set is ~110 tiny files (single-digit ms), so this stays
// far under the 30s ceiling; routing it through ctx is a v0.0.7 cleanup.
import { findNameCollisions } from "../lib/collision-names.mjs";

export const id = "AGENT_NAME_COLLISION";

export function run(ctx) {
  const errors = [];
  const warnings = [];

  const collisions = findNameCollisions(ctx.REPO);
  for (const { name, occurrences } of collisions) {
    const where = occurrences.map((o) => `${o.surface}:${o.file}`).join(", ");
    warnings.push(
      `name "${name}" is claimed by ${occurrences.length} surfaces: ${where}. Cross-surface names collide in the flat host namespace — rename one.`,
    );
  }

  return { errors, warnings };
}
