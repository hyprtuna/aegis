// frontmatter.mjs — section 5: frontmatter on canonical surfaces.
import { relative } from "node:path";

export const id = "FRONTMATTER";

export function run(ctx) {
  const { REPO, files } = ctx;
  const errors = [];
  const warnings = [];

  const surfaces = files.filter((p) => {
    const r = relative(REPO, p);
    return (
      /^skills\/[^/]+\/[^/]+\/SKILL\.md$/.test(r) ||
      (/^agents\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r)) ||
      (/^commands\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r)) ||
      (/^rules\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r)) ||
      // Hook intent docs carry the same lean frontmatter as any other canonical surface.
      // They were unscoped until v0.2.1, which is how `kind: hook` survived the retirement
      // in three files while Iron Law 3 said the field was gone.
      (/^hooks\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r))
    );
  });

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
