// advertised-visibility.test.mjs — the guard must cover every advertised skill, not just the ones
// whose table row happens to be phrased a particular way.
//
// The first version of this rule keyed on the literal word "skill" following a backticked name.
// `sdd-workflow` is advertised in the same table row as `default-feature` but trails with
// "for spec-first)" instead, so it was never captured — the guard would have passed clean while the
// spec-first entry point was hidden from the / menu. These tests pin the extractor against the real
// bootstrap table so that blind spot cannot come back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as rule from "../validate/advertised-visibility.mjs";

const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const BOOTSTRAP = "skills/core/using-aegis/SKILL.md";

// Minimal ctx double matching what validate/index.mjs supplies.
function ctxFor(overrides = {}) {
  const reads = overrides.reads ?? {};
  const files = (overrides.files ?? defaultFiles()).map((r) => join(REPO, r));
  return {
    REPO,
    files,
    read(p) {
      const r = p.slice(REPO.length + 1);
      if (r in reads) return reads[r];
      return readFileSync(p, "utf8");
    },
  };
}

function defaultFiles() {
  return [
    BOOTSTRAP,
    "skills/workflows/sdd-workflow/SKILL.md",
    "skills/workflows/default-feature/SKILL.md",
    "skills/core/implementation-planner/SKILL.md",
  ];
}

function skillDoc(name, visibility) {
  return `---\nname: ${name}\ndescription: Use when testing.\nvisibility: ${visibility}\nplatforms: [claude]\n---\n\nBody.\n`;
}

test("sdd-workflow is advertised and IS covered by the guard", () => {
  // The regression the first implementation missed: same table row as default-feature, but the
  // name is followed by "for spec-first)" rather than "skill".
  const { errors } = rule.run(
    ctxFor({ reads: { "skills/workflows/sdd-workflow/SKILL.md": skillDoc("sdd-workflow", "internal") } }),
  );
  assert.ok(
    errors.some((e) => e.includes("sdd-workflow")),
    `hiding an advertised spec-first entry point must fail; got: ${errors.join(" | ") || "(no errors)"}`,
  );
});

test("default-feature hidden is rejected", () => {
  const { errors } = rule.run(
    ctxFor({ reads: { "skills/workflows/default-feature/SKILL.md": skillDoc("default-feature", "internal") } }),
  );
  assert.ok(errors.some((e) => e.includes("default-feature")), `got: ${errors.join(" | ")}`);
});

test("the live tree is clean", () => {
  const { errors } = rule.run(ctxFor());
  assert.deepEqual(errors, [], `canonical must not advertise a hidden entry point: ${errors.join(" | ")}`);
});

test("a skill NOT in the table may be internal", () => {
  const { errors } = rule.run(
    ctxFor({
      files: [BOOTSTRAP, "skills/core/color-palette-design/SKILL.md"],
      reads: { "skills/core/color-palette-design/SKILL.md": skillDoc("color-palette-design", "internal") },
    }),
  );
  assert.deepEqual(errors, [], `an unadvertised skill may be internal: ${errors.join(" | ")}`);
});

test("a table that stops parsing warns rather than passing silently", () => {
  const { errors, warnings } = rule.run(
    ctxFor({ reads: { [BOOTSTRAP]: "# using-aegis\n\nNo entry-point table here.\n" } }),
  );
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /vacuous/.test(w)), `expected a vacuity warning; got: ${warnings.join(" | ")}`);
});

test("names that parse but resolve to no skill warn as vacuous", () => {
  const { errors, warnings } = rule.run(
    ctxFor({
      files: [BOOTSTRAP],
      reads: {
        [BOOTSTRAP]:
          "## Top User-Invocable Surfaces\n\n| Want to… | Invoke |\n|---|---|\n| Do a thing | `nonexistent-surface` skill |\n",
      },
    }),
  );
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /vacuous/.test(w)), `expected a vacuity warning; got: ${warnings.join(" | ")}`);
});
