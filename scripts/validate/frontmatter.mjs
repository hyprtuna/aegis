// frontmatter.mjs — section 5: frontmatter on canonical surfaces.
import { relative } from "node:path";

export const id = "FRONTMATTER";

// The surface families this rule governs, each keyed by the path shape it matches.
//
// These are structural patterns, and a structural pattern stops matching the moment
// the structure moves. `skills` pins exactly two path segments between `skills/` and
// `SKILL.md`; re-nest a skill one level deeper and it matches nothing — every skill in
// the repo silently leaves this rule's coverage while the run still reports green,
// because "no surfaces" and "no problems" are the same output. Each family therefore
// carries its own match count and says so when that count is zero (see below); a single
// whole-rule guard would not have caught it, since the other four families would keep
// the total non-zero and the guard quiet.
const FAMILIES = [
  { name: "skills", test: (r) => /^skills\/[^/]+\/[^/]+\/SKILL\.md$/.test(r) },
  { name: "agents", test: (r) => /^agents\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r) },
  { name: "commands", test: (r) => /^commands\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r) },
  { name: "rules", test: (r) => /^rules\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r) },
  // Hook intent docs carry the same lean frontmatter as any other canonical surface.
  // They were unscoped until v0.2.1, which is how `kind: hook` survived the retirement
  // in three files while Iron Law 3 said the field was gone.
  { name: "hooks", test: (r) => /^hooks\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r) },
];

export function run(ctx) {
  const { REPO, files } = ctx;
  const errors = [];
  const warnings = [];

  const matchCounts = new Map(FAMILIES.map((f) => [f.name, 0]));
  const surfaces = files.filter((p) => {
    const r = relative(REPO, p);
    const hit = FAMILIES.find((f) => f.test(r));
    if (!hit) return false;
    matchCounts.set(hit.name, matchCounts.get(hit.name) + 1);
    return true;
  });

  // Vacuity guard. WARN rather than error, per the repo's warn-first convention for new
  // validator rules (AGENTS.md): a legitimate future layout may retire a family outright,
  // and a hard-fail would block that change rather than surface it. The point is that the
  // coverage loss is stated out loud instead of passing as silence.
  for (const [name, count] of matchCounts) {
    if (count === 0) {
      warnings.push(
        `no '${name}' surfaces matched — this family's frontmatter went unchecked. ` +
          `Either the family was intentionally retired, or its path shape moved and the ` +
          `pattern in FAMILIES needs updating; until then this rule is vacuous for '${name}'.`,
      );
    }
  }

  for (const s of surfaces) {
    const body = ctx.read(s);
    if (!body.startsWith("---\n")) {
      errors.push(`missing frontmatter: ${relative(REPO, s)}`);
      continue;
    }
    const fmEnd = body.indexOf("\n---", 4);
    if (fmEnd < 0) {
      errors.push(`unclosed frontmatter: ${relative(REPO, s)}`);
      continue;
    }
    const fm = body.slice(4, fmEnd);
    const required = ["name:", "description:", "visibility:", "platforms:"];
    for (const k of required) {
      if (!fm.includes(k)) {
        errors.push(`frontmatter missing '${k}': ${relative(REPO, s)}`);
      }
    }
    // `kind:` is RETIRED. It had no upstream counterpart on any host (Claude Code's
    // documented skill frontmatter has no such field; OpenCode ignores unknown keys),
    // it was already discarded at projection, and it carried no information a canonical
    // surface's own directory does not already state — a file under skills/ is a skill,
    // under agents/ an agent. Reject it so it cannot drift back in.
    if (/^kind:/m.test(fm)) {
      errors.push(
        `frontmatter carries retired key 'kind:': ${relative(REPO, s)} — ` +
          `the surface kind is derived from the directory; remove the line.`,
      );
    }
  }

  return { errors, warnings };
}
