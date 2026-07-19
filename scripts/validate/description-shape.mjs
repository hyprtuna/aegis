// description-shape.mjs — every skill/agent `description` should read
// as a pure WHEN-to-use trigger, not a WHAT-it-does mechanism summary.
//
// For every skill `SKILL.md` (skills/**) and every agents/*.md (excluding
// AGENTS.md/CLAUDE.md), parse `description` from cached frontmatter and WARN
// (never error) when it carries a mechanism marker: an arrow (`→`/`->`) or a
// conjugated process verb (`runs `/`emits `/`orchestrates `/`dispatches `).
//
// Deliberately narrow (RESOLVED scope, see the v0.1.2 implementation plan §3.3):
// the "Use when X — <gloss>" em-dash shape is house style across ~40
// descriptions and is NOT flagged — a literal em-dash marker would fire
// catalog-wide. Arrow + the four conjugated verbs are the mechanical proxy for
// the pipeline/step-enumeration smell the audit actually names.
//
// WARN-ONLY (new-rule cadence). Graduation target: hard-fail in v0.1.3,
// preconditioned on (a) canonical staying clean for one full release and (b) a
// situational-arrow guard so a future "migrate React -> Vue"-style trigger
// clause is not falsely flagged (see docs/validators.md). Reuses the shared ctx
// (ctx.files / ctx.rel / ctx.read / ctx.fmSplit) — no second walk.
export const id = "DESCRIPTION_SHAPE";

// Mechanism markers. MECH_VERB requires a trailing space so the `dispatch`
// noun (e.g. "agent dispatch") never matches the conjugated verb form.
const MECH_ARROW = /→|->/;
const MECH_VERB = /\b(runs|emits|orchestrates|dispatches)\s/i;

export function run(ctx) {
  const { files, rel } = ctx;
  const errors = [];
  const warnings = [];

  const targets = files.filter((p) => {
    const r = rel(p);
    if (/^skills\/.+\/SKILL\.md$/.test(r)) return true;
    if (/^agents\/[^/]+\.md$/.test(r)) {
      const base = r.slice("agents/".length);
      return base !== "AGENTS.md" && base !== "CLAUDE.md";
    }
    return false;
  });

  for (const p of targets) {
    const text = ctx.read(p);
    const split = ctx.fmSplit(text);
    if (split.fm === null) continue; // FRONTMATTER rule handles missing fm
    const m = split.fm.match(/^description:\s*(.+)$/m);
    if (!m) continue; // FRONTMATTER rule handles missing description
    const desc = m[1].trim().replace(/^["']|["']$/g, "");

    const arrowHit = MECH_ARROW.test(desc);
    const verbMatch = desc.match(MECH_VERB);
    if (!arrowHit && !verbMatch) continue;

    const token = arrowHit ? (desc.includes("→") ? "→" : "->") : verbMatch[1];
    warnings.push(
      `${rel(p)} description contains a mechanism marker "${token}" — describe WHEN to use, not WHAT it does (warn-only; graduates to hard-fail in a later release). [DESCRIPTION_SHAPE]`,
    );
  }

  return { errors, warnings };
}
