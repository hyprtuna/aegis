// skill-size.mjs — v0.0.14: canonical SKILL.md body size cap.
//
// THE single owner of the >100-line body-size warning. This rule replaces the
// body-length half of the former skill-body-long.mjs check: that module now
// emits ONLY SKILL_DESC_LONG (the frontmatter description-length cap), so a
// skill over 100 lines produces exactly ONE size finding, never two.
//
// For skills/<scope>/<name>/SKILL.md:
//   - SKILL_SIZE: body (after frontmatter) exceeds 100 lines.
//
// WARN-ONLY this release: 29 canonical skills currently exceed 100 lines and
// hard-failing would break the build. Progressive disclosure (v0.0.14 Phase A)
// restructures them into a lean SKILL.md + references/ / abilities/ overflow a
// few at a time; the cap graduates to hard-fail once the backlog is cleared
// (per the v0.0.6 -> v0.0.7 warn->error graduation convention). Overflow detail
// belongs in `references/<x>.md` (deep reference) or `abilities/<x>.md`
// (on-demand fragments), which stay unregistered per Iron Law 4.
export const id = "SKILL_SIZE";

// The bucket segment is matched structurally (`[^/]+`) rather than against an enumerated
// bucket list. An enumerated copy of that list lived in a dozen files; dissolving a bucket
// left the stale copies matching nothing, and a rule that matches nothing passes silently.
const BODY_LINE_CAP = 100;

export function run(ctx) {
  const { files, rel } = ctx;
  const errors = [];
  const warnings = [];

  const re = new RegExp(`^skills/[^/]+/[^/]+/SKILL\\.md$`);
  const skillFiles = files.filter((p) => re.test(rel(p)));

  for (const sf of skillFiles) {
    const text = ctx.read(sf);
    const split = ctx.fmSplit(text);
    if (split.fm === null) continue; // frontmatter rule handles missing fm

    // Body line count. fmSplit's body begins right after the closing `---`;
    // trim a single leading newline so the count reflects content lines.
    const body = split.body.replace(/^\n/, "");
    const lineCount = body.split("\n").length;
    if (lineCount > BODY_LINE_CAP) {
      warnings.push(
        `${rel(sf)} body is ${lineCount} lines (>${BODY_LINE_CAP}). Split detail into references/ or abilities/. [SKILL_SIZE, warn-only]`,
      );
    }
  }

  return { errors, warnings };
}
