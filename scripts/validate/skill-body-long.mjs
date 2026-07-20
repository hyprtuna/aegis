// skill-body-long.mjs — A5: canonical skill description-length warning.
//
// As of v0.0.14 the body-length (>100-line) check moved to the
// dedicated skill-size.mjs rule (`SKILL_SIZE`) so the size cap has a single
// owner and a skill over 100 lines produces exactly ONE size finding. This
// module now owns ONLY the frontmatter description-length cap:
//   - SKILL_DESC_LONG: frontmatter `description:` value exceeds 1024 chars.
// Warn-only. The module id stays `SKILL_DESC_LONG`.
export const id = "SKILL_DESC_LONG";

// The bucket segment is matched structurally (`[^/]+`) rather than against an enumerated
// bucket list. An enumerated copy of that list lived in a dozen files; dissolving a bucket
// left the stale copies matching nothing, and a rule that matches nothing passes silently.
const DESC_CHAR_CAP = 1024;

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

    const m = split.fm.match(/^description:\s*(.+)$/m);
    if (m) {
      const desc = m[1].trim().replace(/^["']|["']$/g, "");
      if (desc.length > DESC_CHAR_CAP) {
        warnings.push(
          `${rel(sf)} frontmatter description is ${desc.length} chars (>${DESC_CHAR_CAP}). [SKILL_DESC_LONG]`,
        );
      }
    }
  }

  return { errors, warnings };
}
