// trigger-phrase.mjs — every skill/agent `description` must carry a
// "Use when…" trigger clause for reliable selection.
//
// For every skill `SKILL.md` (skills/**) and every agents/*.md (excluding
// AGENTS.md / CLAUDE.md), parse `description` from cached frontmatter and WARN
// (never error) when it lacks a case-insensitive "use when" trigger clause.
//
// WARN-ONLY in v0.0.12 (new-rule cadence); graduates to HARD-FAIL in v0.0.13.
// The lint is purely diagnostic — it never rewrites a description. Reuses the
// shared ctx (ctx.files / ctx.rel / ctx.read / ctx.fmSplit) — no second walk.
export const id = "TRIGGER_PHRASE";

// Case-insensitive "use when" anchor. Allows an arbitrary run of whitespace
// between the two words (e.g. "Use  when", "use\nwhen") so wrapped descriptions
// still match.
const TRIGGER_RE = /\buse\s+when\b/i;

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
    if (!TRIGGER_RE.test(desc)) {
      warnings.push(
        `${rel(p)} description lacks a "Use when…" trigger clause (warn-only; graduates to hard-fail in v0.0.13). [TRIGGER_PHRASE]`,
      );
    }
  }

  return { errors, warnings };
}
