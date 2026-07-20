// skill-scopes.mjs — the single source for "which buckets under skills/ hold skills".
//
// WHY THIS EXISTS
// ---------------
// The bucket list used to be a `["core", "languages", "workflows"]` literal copied into a dozen
// call sites across the projector, the validators, and the projection tests. Dissolving one
// bucket therefore meant finding every copy; missing one did not error, it just made that check
// or that projection quietly cover nothing. `inventory.mjs` reported 0 for 28 live files exactly
// this way, and a stale `["core", "workflows"]` in a discovery helper would have blinded the
// projection tests to a whole scope without a single failing assertion.
//
// Discovery is therefore derived from the filesystem: a bucket is any directory under `skills/`
// that holds at least one `<name>/SKILL.md`. Adding or removing a bucket needs no code change,
// and a bucket that exists can never be silently skipped.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Sorted bucket names under <REPO>/skills that contain at least one skill.
// Returns [] when skills/ is absent — callers that must not run vacuously should
// say so themselves rather than relying on a thrown error here.
export function skillScopes(REPO) {
  const skillsDir = join(REPO, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .filter((entry) => {
      const scopeDir = join(skillsDir, entry);
      if (!isDir(scopeDir)) return false;
      return readdirSync(scopeDir).some((n) => existsSync(join(scopeDir, n, "SKILL.md")));
    })
    .sort();
}

// Every canonical skill as { scope, name, dir, file } — the common walk built on skillScopes.
export function skillDirs(REPO) {
  const out = [];
  for (const scope of skillScopes(REPO)) {
    const scopeDir = join(REPO, "skills", scope);
    for (const name of readdirSync(scopeDir).sort()) {
      const dir = join(scopeDir, name);
      const file = join(dir, "SKILL.md");
      if (!isDir(dir) || !existsSync(file)) continue;
      out.push({ scope, name, dir, file });
    }
  }
  return out;
}
