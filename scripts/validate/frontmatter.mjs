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
      (/^rules\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r))
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
    const required = ["kind:", "name:", "description:", "visibility:", "platforms:"];
    for (const k of required) {
      if (!fm.includes(k)) {
        errors.push(`frontmatter missing '${k}': ${relative(REPO, s)}`);
      }
    }
  }

  return { errors, warnings };
}
