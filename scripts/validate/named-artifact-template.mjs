// named-artifact-template.mjs — v0.0.9 (AG-0160): named-artifact → template rule.
//
// Rule (rules/templates.md): any skill/agent that emits a NAMED artifact MUST
// reference a template kind via a `${TEMPLATE:<kind>}` reference OR carry a
// `// REASON:` note justifying why no template applies.
//
// This check is the PRODUCER side: it scans canonical skill `SKILL.md` bodies
// and `agents/*.md` bodies for a clear named-artifact emission signal (an
// `## Output` / `## Deliverables` / `## Structured Output` section heading) and
// WARNS when such a body carries neither a `${TEMPLATE:` reference nor a
// `// REASON:` note.
//
// WARN-ONLY in v0.0.9 (exit 0 preserved — pushes only `warnings`). It surfaces
// the remaining unwired-producer backlog; producers are wired (or given a
// `// REASON:`) in later releases, and the rule graduates to hard-fail then,
// consistent with the v0.0.6 → v0.0.7 warn → error convention (AGENTS.md).
//
// designOnly note: this is a producer-side check, so `designOnly` kinds (which
// by definition have no producer) never appear here. The expected-orphan
// semantics for designOnly kinds live in template-index.mjs. Recorded so a
// future kind-coverage extension keeps designOnly kinds exempt.
//
// Reuses the shared ctx (ctx.files / ctx.rel / ctx.read / ctx.fmSplit) — no
// second filesystem walk.

export const id = "NAMED_ARTIFACT_TEMPLATE";

const SKILL_SCOPES = ["core", "languages", "workflows"];

// A named-artifact emission signal: a section heading that introduces a durable
// structured deliverable. Conservative — disciplines whose "output" is inline
// findings prose with no such heading are not flagged.
const ARTIFACT_HEADING = /^#{2,}\s+(output(\s+format)?|deliverables?(\s+format)?|structured\s+output)\b/im;

export function run(ctx) {
  const { files, rel } = ctx;
  const warnings = [];

  const skillRe = new RegExp(`^skills/(${SKILL_SCOPES.join("|")})/[^/]+/SKILL\\.md$`);
  const agentRe = /^agents\/[^/]+\.md$/;

  const producers = files.filter((p) => {
    const r = rel(p);
    if (skillRe.test(r)) return true;
    // agents/ holds no AGENTS.md/CLAUDE.md (forbidden there), but guard anyway.
    if (agentRe.test(r) && !/\/(AGENTS|CLAUDE)\.md$/.test(r)) return true;
    return false;
  });

  for (const p of producers) {
    const text = ctx.read(p);
    const split = ctx.fmSplit(text);
    const body = split.fm === null ? text : split.body;

    // Match the heading on fence-stripped text so a `## Output` inside an example
    // code block does not false-trigger; clear-conditions check the full body.
    const scan = ctx.stripFences(body);
    if (!ARTIFACT_HEADING.test(scan)) continue; // no named-artifact signal
    if (body.includes("${TEMPLATE:")) continue; // references a template kind
    if (body.includes("// REASON:")) continue; // justified exception

    warnings.push(
      `${rel(p)} emits a named-artifact output section but references no template kind ` +
        `(no \`\${TEMPLATE:<kind>}\` reference) and carries no \`// REASON:\` note. ` +
        `Wire it to a template kind or add a \`// REASON:\` justification. [NAMED_ARTIFACT_TEMPLATE, warn-only]`,
    );
  }

  return { errors: [], warnings };
}
