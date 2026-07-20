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

// Rows in the entry-point table look like:
//   | Build a feature end-to-end | `default-feature` skill (or `sdd-workflow` for spec-first) |
//   | Review a diff              | `code-reviewer` agent (`--type both`) |
//
// Capture EVERY backticked token in the row, then classify by what it resolves to on disk. An
// earlier version keyed on the literal word "skill" following the name, which silently missed
// `sdd-workflow` — advertised in the same row, but trailed by "for spec-first)" instead. A guard
// against silent hiding that can itself be silently bypassed is worse than none, so the extractor
// no longer depends on prose shape.
function advertisedNames(bootstrapBody) {
  const names = new Set();
  let inTable = false;

  for (const line of bootstrapBody.split("\n")) {
    if (/Top User-Invocable Surfaces/i.test(line)) {
      inTable = true;
      continue;
    }
    // The table ends at the next heading.
    if (inTable && /^#{1,6}\s/.test(line)) break;
    if (!inTable || !line.trim().startsWith("|")) continue;

    for (const m of line.matchAll(/`([a-z0-9-]+)`/g)) names.add(m[1]);
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

  const advertised = advertisedNames(ctx.read(bootstrap));
  if (advertised.size === 0) {
    warnings.push(
      `${BOOTSTRAP}: no backticked names parsed from the entry-point table — ` +
        `the table shape may have changed and this check is now vacuous`,
    );
    return { errors, warnings };
  }

  // Backticked tokens that resolve to a skill on disk are the ones this rule governs. Anything
  // else in the table (agent names, flags like `--type both`) resolves to nothing here and is
  // ignored — classification comes from the filesystem, not from the surrounding prose.
  let matched = 0;

  for (const p of files) {
    const r = relative(REPO, p);
    const m = /^skills\/[^/]+\/([^/]+)\/SKILL\.md$/.exec(r);
    if (!m) continue;

    const name = m[1];
    if (!advertised.has(name)) continue;
    matched++;

    const body = ctx.read(p);
    if (/^visibility:\s*internal\s*$/m.test(body)) {
      errors.push(
        `${r}: "${name}" is advertised as a user entry point in ${BOOTSTRAP}, but declares ` +
          `visibility: internal — which projects to user-invocable: false and hides it from the ` +
          `/ menu. Either set visibility: user, or stop advertising it in the entry-point table.`,
      );
    }
  }

  // Second vacuity guard: names parsed, but none of them resolved to a skill. That means the table
  // still exists and still has backticks, while this rule is checking nothing at all.
  if (matched === 0) {
    warnings.push(
      `${BOOTSTRAP}: parsed ${advertised.size} name(s) from the entry-point table but none ` +
        `resolved to a skill — this check ran vacuously`,
    );
  }

  return { errors, warnings };
}
