// agent-plugin-drop.mjs — (v0.1.0): flag subagent frontmatter
// fields that Claude SILENTLY DROPS when the agent is loaded from a plugin.
//
// Claude drops `hooks`, `mcpServers`, and `permissionMode` from a subagent's
// frontmatter when that subagent ships inside a plugin (cc-docs
// sub-agents.md:233-234). Aegis ships its agents AS a plugin, so projecting any
// of those three under `x-claude:` into adapters/claude/agents/*.md would be a
// silent no-op that LOOKS correct — the field is present but never honored.
//
// This rule walks canonical agents/*.md, parses the top-level `x-claude:` block,
// and WARNS once per offending field. NOTE: `memory`, `skills`, `effort`,
// `isolation`, and `model` ARE honored for plugin-loaded subagents — they are
// deliberately NOT flagged.
//
// WARN-ONLY (new-rule cadence). Reuses the shared ctx (ctx.files / ctx.rel /
// ctx.read / ctx.fmSplit) — no second walk, no deps.
export const id = "AGENT_PLUGIN_DROP";

// The three fields Claude silently drops for plugin-loaded subagents.
const DROPPED_FIELDS = ["hooks", "mcpServers", "permissionMode"];

// Collect the keys declared under the top-level `x-claude:` block. Scans the
// frontmatter for an `x-claude:` line, then gathers the immediate child keys
// (one indent level) up to the next zero-indent (top-level) key. Mirrors the
// nested-block scan in stance.mjs; no YAML dependency.
function xClaudeChildKeys(fm) {
  const lines = fm.split("\n");
  const keys = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (!/^x-claude:\s*$/.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (/^\S/.test(line)) break; // next top-level key — block ended
      if (/^\s*$/.test(line)) continue; // blank line inside block
      const m = line.match(/^\s+([A-Za-z0-9_-]+):/);
      // Only count the first indent level (direct children), not deeper nesting.
      if (m && /^( {2}|\t)[A-Za-z0-9_-]+:/.test(line)) keys.add(m[1]);
    }
  }
  return keys;
}

export function run(ctx) {
  const { files, rel } = ctx;
  const errors = [];
  const warnings = [];

  const agents = files.filter((p) => {
    const r = rel(p);
    if (!/^agents\/[^/]+\.md$/.test(r)) return false;
    const base = r.slice("agents/".length);
    return base !== "AGENTS.md" && base !== "CLAUDE.md";
  });

  for (const p of agents) {
    const split = ctx.fmSplit(ctx.read(p));
    if (split.fm === null) continue; // frontmatter rule handles missing fm
    const childKeys = xClaudeChildKeys(split.fm);
    for (const field of DROPPED_FIELDS) {
      if (!childKeys.has(field)) continue;
      warnings.push(
        `${rel(p)} declares \`x-claude.${field}\`, but Claude SILENTLY DROPS hooks/mcpServers/permissionMode from subagent frontmatter when the agent is loaded from a plugin (cc-docs sub-agents.md:233-234). Aegis ships agents as a plugin, so this projects to a no-op that looks correct. Remove it or move the behavior to a host-honored mechanism. [AGENT_PLUGIN_DROP, warn-only]`,
      );
    }
  }

  return { errors, warnings };
}
