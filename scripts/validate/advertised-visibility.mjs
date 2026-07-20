// advertised-visibility.mjs — a skill Aegis advertises as a user entry point
// must not be hidden from the host's `/` menu.
//
// WHY THIS EXISTS
// ---------------
// `visibility:` was declared on 123 surfaces while branching zero lines of code. Because nothing read
// it, nothing ever checked the values were right. Projecting it to native `user-invocable: false`
// makes it load-bearing — which promotes every one of those unaudited declarations straight into
// user-facing behaviour in a single release.
//
// Two of the eight `visibility: internal` skills were the workflow entry points named in
// `skills/core/using-aegis/SKILL.md`'s own "Top User-Invocable Surfaces (start here)" table. Shipping
// that would have hidden `default-feature` — the documented way to start a feature — from the `/`
// menu, while the bootstrap kept telling users to reach for it.
//
// The failure is silent in both directions: nothing errors, the skill simply stops appearing, and the
// table goes on advertising it. So the agreement gets a check rather than a convention.

import { relative } from "node:path";

export const id = "ADVERTISED_VISIBILITY";

const BOOTSTRAP = "skills/core/using-aegis/SKILL.md";

// Rows in the entry-point table look like:  | Build a feature end-to-end | `default-feature` skill |
// Pull every backticked skill name out of the table body.
function advertisedSkills(bootstrapBody) {
  const names = new Set();
  const lines = bootstrapBody.split("\n");
  let inTable = false;

  for (const line of lines) {
    if (/Top User-Invocable Surfaces/i.test(line)) {
      inTable = true;
      continue;
    }
    // The table ends at the next heading.
    if (inTable && /^#{1,6}\s/.test(line)) break;
    if (!inTable || !line.trim().startsWith("|")) continue;

    for (const m of line.matchAll(/`([a-z0-9-]+)`\s*skill/g)) names.add(m[1]);
  }
  return names;
}

export function run(ctx) {
  const { REPO, files } = ctx;
  const errors = [];
  const warnings = [];

  const bootstrap = files.find((p) => relative(REPO, p) === BOOTSTRAP);
  if (!bootstrap) {
    // Not this rule's job to police the bootstrap's existence, but a silent skip would make the
    // whole check vacuous — say so.
    warnings.push(`${BOOTSTRAP} not found — advertised-entry-point check did not run`);
    return { errors, warnings };
  }

  const advertised = advertisedSkills(ctx.read(bootstrap));
  if (advertised.size === 0) {
    warnings.push(
      `${BOOTSTRAP}: no advertised skills parsed from the entry-point table — ` +
        `the table shape may have changed and this check is now vacuous`,
    );
    return { errors, warnings };
  }

  for (const p of files) {
    const r = relative(REPO, p);
    const m = /^skills\/[^/]+\/([^/]+)\/SKILL\.md$/.exec(r);
    if (!m) continue;

    const name = m[1];
    if (!advertised.has(name)) continue;

    const body = ctx.read(p);
    if (/^visibility:\s*internal\s*$/m.test(body)) {
      errors.push(
        `${r}: "${name}" is advertised as a user entry point in ${BOOTSTRAP}, but declares ` +
          `visibility: internal — which projects to user-invocable: false and hides it from the ` +
          `/ menu. Either set visibility: user, or stop advertising it in the entry-point table.`,
      );
    }
  }

  return { errors, warnings };
}
