// templates.mjs — section 7c: hard-error on any template body missing a sibling
// <name>.template.json (graduated from warning → error in v0.0.8, once
// every shipped body carries a manifest); hard-error on any present manifest that
// is malformed.
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

export const id = "TEMPLATES";

export function run(ctx) {
  const { REPO, walk } = ctx;
  const errors = [];
  const warnings = [];

  const templatesRoot = join(REPO, "templates");
  if (existsSync(templatesRoot)) {
    const TEMPLATE_EXT = /\.(html|md|json)$/;
    for (const family of ["html", "markdown", "json"]) {
      const familyDir = join(templatesRoot, family);
      if (!existsSync(familyDir)) continue;
      for (const file of walk(familyDir)) {
        const rel = relative(REPO, file);
        const base = file.replace(/^.*\//, "");
        if (base === "AGENTS.md" || base === "CLAUDE.md" || base === "README.md") continue;
        if (base.endsWith(".template.json")) {
          // Validate the manifest itself.
          let m;
          try { m = JSON.parse(ctx.read(file)); } catch (e) {
            errors.push(`template manifest invalid JSON: ${rel} (${e.message})`);
            continue;
          }
          if (m.kind !== "template") errors.push(`template manifest ${rel}: kind must be 'template'`);
          for (const k of ["name", "family", "version", "description"]) {
            if (!m[k]) errors.push(`template manifest ${rel}: missing '${k}'`);
          }
          if (!Array.isArray(m.slots)) errors.push(`template manifest ${rel}: 'slots' must be an array`);
          if (m.family && !["html", "markdown", "json"].includes(m.family)) {
            errors.push(`template manifest ${rel}: family must be html|markdown|json`);
          }
          continue;
        }
        if (!TEMPLATE_EXT.test(base)) continue;
        // A template body file — require a sibling manifest (hard error as of v0.0.8).
        const manifestPath = file.replace(TEMPLATE_EXT, ".template.json");
        if (!existsSync(manifestPath)) {
          errors.push(`template missing sibling manifest (hard error as of v0.0.8): ${rel}`);
        }
      }
    }
  }

  return { errors, warnings };
}
