// lockfile.mjs — C1: external-skill lockfile assertion.
//
// skills-lock.json (repo root) records skills installed from OUTSIDE the package.
// Lean schema: { "version": 1, "skills": { "<name>": { ...lock entry } } }.
//
// Semantics are external-source-aware: in-tree canonical skills do NOT need lock
// entries — they ARE the source. Only skills carrying an external-source marker
// need a lock entry. None exist today, so this rule effectively no-ops, but it is
// implemented defensively for the future.
//
// External-source detection ASSUMPTION: an externally-sourced skill is one whose
// SKILL.md frontmatter carries a `source:` value that is NOT the in-tree
// `anvil:<path>` marker (the documented migration marker). Any other `source:`
// scheme (e.g. a URL or `<registry>:<name>` form) is treated as external and must
// have a matching key in skills-lock.json's `skills` map. When external skills
// gain a richer marker, refine here. Warn-only.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const id = "SKILL_LOCK_MISSING";

const SCOPES = ["core", "languages", "workflows"];

export function run(ctx) {
  const { files, rel } = ctx;
  const errors = [];
  const warnings = [];

  const lockPath = join(ctx.REPO, "skills-lock.json");
  if (!existsSync(lockPath)) {
    warnings.push(
      "skills-lock.json is missing at the repo root — expected the lean seed { \"version\": 1, \"skills\": {} }.",
    );
    return { errors, warnings };
  }

  let lock;
  try {
    lock = JSON.parse(ctx.read(lockPath));
  } catch (e) {
    warnings.push(`skills-lock.json is malformed JSON: ${e.message}`);
    return { errors, warnings };
  }
  if (typeof lock !== "object" || lock === null || typeof lock.version !== "number" || typeof lock.skills !== "object" || lock.skills === null) {
    warnings.push(
      "skills-lock.json does not match the lean schema { version: <number>, skills: <object> }.",
    );
    return { errors, warnings };
  }

  // Scan canonical skills for an external-source marker without a lock entry.
  const re = new RegExp(`^skills/(${SCOPES.join("|")})/[^/]+/SKILL\\.md$`);
  const skillFiles = files.filter((p) => re.test(rel(p)));
  for (const sf of skillFiles) {
    const split = ctx.fmSplit(ctx.read(sf));
    if (split.fm === null) continue;
    const m = split.fm.match(/^source:\s*(.+)$/m);
    if (!m) continue;
    const source = m[1].trim().replace(/^["']|["']$/g, "");
    // in-tree migration marker → not external, no lock entry required.
    if (source.startsWith("anvil:")) continue;
    // Any other source scheme is treated as external.
    const nameMatch = split.fm.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, "") : null;
    if (name && !Object.prototype.hasOwnProperty.call(lock.skills, name)) {
      warnings.push(
        `${rel(sf)} declares external source "${source}" but has no entry in skills-lock.json (key "${name}").`,
      );
    }
  }

  return { errors, warnings };
}
