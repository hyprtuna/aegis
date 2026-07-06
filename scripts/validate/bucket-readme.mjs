// bucket-readme.mjs — A6: bucket / template-family README coverage.
//
// Every skill bucket (skills/core, skills/languages, skills/workflows) and every
// template family (templates/html, templates/markdown, templates/json) that
// EXISTS must contain a README.md that mentions every shipping child surface.
//
// Children: the manifest (manifest/aegis.manifest.json) does NOT enumerate the
// per-bucket child set (canonicalSurfaces lists surface KINDS, not names), so we
// derive children from the directory:
//   - skill buckets: each subdirectory holding a SKILL.md (folder name == child).
//   - template families: each base name of a shipping template file. We strip
//     the `.template.json` companion and use the rendered artifact stem (e.g.
//     `code-review.html` + `code-review.template.json` → child `code-review`).
//
// Warn (not error) when the README is missing OR omits a shipping child. A child
// is "mentioned" if its name appears anywhere in the README text. Warn-only.
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const id = "BUCKET_README_MISSING";

const SKILL_BUCKETS = ["skills/core", "skills/languages", "skills/workflows"];
const TEMPLATE_FAMILIES = ["templates/html", "templates/markdown", "templates/json"];

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Skill-bucket children: subdirs that contain a SKILL.md.
function skillChildren(absBucket) {
  const out = [];
  for (const entry of readdirSync(absBucket)) {
    const dir = join(absBucket, entry);
    if (isDir(dir) && existsSync(join(dir, "SKILL.md"))) out.push(entry);
  }
  return out.sort();
}

// Template-family children: distinct base stems of shipping template files,
// excluding the `.template.json` config companions.
function templateChildren(absFamily) {
  const stems = new Set();
  for (const entry of readdirSync(absFamily)) {
    if (entry === "README.md") continue;
    const full = join(absFamily, entry);
    if (isDir(full)) {
      stems.add(entry); // nested family group (e.g. markdown/decisions)
      continue;
    }
    if (entry.endsWith(".template.json")) continue; // config companion, not a child
    const dot = entry.indexOf(".");
    stems.add(dot > 0 ? entry.slice(0, dot) : entry);
  }
  return [...stems].sort();
}

function checkBucket(ctx, relBucket, children, warnings) {
  const absReadme = join(ctx.REPO, relBucket, "README.md");
  if (!existsSync(absReadme)) {
    warnings.push(
      `${relBucket}/README.md is missing — every bucket/family must list its shipping children (${children.length} found).`,
    );
    return;
  }
  const text = ctx.read(absReadme);
  const missing = children.filter((c) => !text.includes(c));
  if (missing.length > 0) {
    warnings.push(
      `${relBucket}/README.md omits ${missing.length} shipping child/children: ${missing.join(", ")}.`,
    );
  }
}

export function run(ctx) {
  const errors = [];
  const warnings = [];

  for (const relBucket of SKILL_BUCKETS) {
    const abs = join(ctx.REPO, relBucket);
    if (!isDir(abs)) continue;
    checkBucket(ctx, relBucket, skillChildren(abs), warnings);
  }

  for (const relFamily of TEMPLATE_FAMILIES) {
    const abs = join(ctx.REPO, relFamily);
    if (!isDir(abs)) continue;
    checkBucket(ctx, relFamily, templateChildren(abs), warnings);
  }

  return { errors, warnings };
}
