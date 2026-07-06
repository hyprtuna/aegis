// stance.mjs — D2 (AG-0197): cross-check the skeptical-stance opt-in field
// against the agent body's adversarial voice.
//
// `x-aegis.stance: skeptical` is the discoverable opt-in (see
// rules/skeptical-stance.md). This rule flags drift in EITHER direction:
//   - an agent whose body carries the adversarial voice but does NOT declare
//     `x-aegis.stance: skeptical`;
//   - an agent that DECLARES the field but whose body does not open with the
//     skeptical framing.
//
// WARN-ONLY (new-rule cadence). Reuses the shared ctx (ctx.files / ctx.rel /
// ctx.read / ctx.fmSplit) — no second walk.
export const id = "STANCE";

// Heuristic markers of the skeptical-by-default voice an opted-in agent OPENS
// with. Reasonable, not exhaustive — this is a warn-only diagnostic. NOTE: the
// bare word "adversarial" is deliberately excluded: several neutral-voice agents
// (orchestrator, subagent-executor) merely *reference* `code-reviewer --strict`'s
// adversarial lens as a dispatch target without themselves carrying the stance.
// The framing phrases below identify the actual skeptical opening, not a mention.
const VOICE_RE = /\bskeptical\b|wrong until|rubber-?stamp|guilty until|\bGSD\b/i;

// Detect the `x-aegis.stance: skeptical` opt-in in the frontmatter. Accepts the
// nested block form:
//   x-aegis:
//     stance: skeptical
// and the inline-ish form `x-aegis: { stance: skeptical }`.
function declaresSkeptical(fm) {
  // Nested block: find an `x-aegis:` line, then a `stance: skeptical` line
  // before the next zero-indent key.
  const lines = fm.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^x-aegis:\s*$/.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\S/.test(lines[j])) break; // next top-level key — block ended
        if (/^\s+stance:\s*skeptical\s*$/.test(lines[j])) return true;
      }
    }
    // Inline form: x-aegis: { stance: skeptical }
    if (/^x-aegis:\s*\{[^}]*stance:\s*skeptical[^}]*\}\s*$/.test(lines[i])) return true;
  }
  return false;
}

// Does the body "open with" skeptical framing? Check the first ~40 non-empty
// content lines after frontmatter (skip the Status: line and headings) for a
// voice marker.
function opensSkeptical(body) {
  const head = body.replace(/^\n/, "").split("\n").slice(0, 40).join("\n");
  return VOICE_RE.test(head);
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
    const text = ctx.read(p);
    const split = ctx.fmSplit(text);
    if (split.fm === null) continue;

    const declared = declaresSkeptical(split.fm);
    const bodyVoice = VOICE_RE.test(split.body);
    const opens = opensSkeptical(split.body);

    if (bodyVoice && !declared) {
      warnings.push(
        `${rel(p)} body carries the adversarial/skeptical voice but does not declare \`x-aegis.stance: skeptical\` (see rules/skeptical-stance.md). [STANCE]`,
      );
    }
    if (declared && !opens) {
      warnings.push(
        `${rel(p)} declares \`x-aegis.stance: skeptical\` but its body does not open with the skeptical framing. [STANCE]`,
      );
    }
  }

  return { errors, warnings };
}
