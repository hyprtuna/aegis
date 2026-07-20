// composition.test.mjs — the chain graph must come from the prose the model actually reads.
//
// Until v0.2.2 this rule built its graph from an `x-aegis.pipeline` frontmatter block that the
// projector stripped before any host saw it. The rule was green about a mechanism that routed
// nothing: a skill could declare `next: foo`, never mention foo in its body, and pass.
//
// These tests pin the properties that made the old version worthless, so the new one cannot rot
// back into them: edges must be read from the BODY, a wrapped prose line must not silently drop
// an edge, a stale name must be reported, and an empty graph must announce itself rather than
// pass quietly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as rule from "../validate/composition.mjs";

const REPO = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// Minimal ctx double matching what validate/index.mjs supplies.
function ctxFor(docs) {
  const files = Object.keys(docs).map((r) => join(REPO, r));
  return {
    REPO,
    files,
    rel: (p) => p.slice(REPO.length + 1),
    read: (p) => docs[p.slice(REPO.length + 1)],
    fmSplit(text) {
      const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      return m ? { fm: m[1], body: m[2] } : { fm: null, body: text };
    },
  };
}

const skill = (name, body) =>
  `---\nname: ${name}\ndescription: Use when testing.\nvisibility: user\nplatforms: [claude]\n---\n\n${body}\n`;

const at = (name) => `skills/core/${name}/SKILL.md`;

test("a heading-form REQUIRED SUB-SKILL edge to a real skill is clean", () => {
  const { errors, warnings } = rule.run(
    ctxFor({
      [at("alpha")]: skill("alpha", "## REQUIRED SUB-SKILL: beta\n\nHand off to beta."),
      [at("beta")]: skill("beta", "Terminal."),
    }),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, [], `expected no warnings; got: ${warnings.join(" | ")}`);
});

test("a REQUIRED SUB-SKILL naming a skill that does not exist is reported", () => {
  const { warnings } = rule.run(
    ctxFor({ [at("alpha")]: skill("alpha", "## REQUIRED SUB-SKILL: ghost\n\nGone.") }),
  );
  assert.ok(
    warnings.some((w) => w.includes("ghost")),
    `a stale prose edge misdirects the model and must be reported; got: ${warnings.join(" | ") || "(none)"}`,
  );
});

test("an inline edge whose skill name wrapped to the next line is still captured", () => {
  // The regression a line-scoped matcher has: the marker and the name sit on different lines,
  // so the edge is dropped and its stale target never checked.
  const { warnings } = rule.run(
    ctxFor({
      [at("alpha")]: skill("alpha", "**REQUIRED SUB-SKILL:** use the successor,\nnamely `aegis:ghost` for the next phase."),
    }),
  );
  assert.ok(
    warnings.some((w) => w.includes("ghost")),
    `a wrapped prose edge must not be silently dropped; got: ${warnings.join(" | ") || "(none)"}`,
  );
});

test("REQUIRED BACKGROUND is existence-checked but is NOT a cycle edge", () => {
  // beta names alpha as background while alpha hands off to beta. That is a correct
  // upstream-prerequisite pointer, not a loop, and must not be reported as a cycle.
  const { warnings } = rule.run(
    ctxFor({
      [at("alpha")]: skill("alpha", "## REQUIRED SUB-SKILL: beta\n\nGo."),
      [at("beta")]: skill("beta", "**REQUIRED BACKGROUND:** understand `aegis:alpha` first."),
    }),
  );
  assert.ok(
    !warnings.some((w) => w.includes("cycle")),
    `a background pointer to an upstream skill is not a cycle; got: ${warnings.join(" | ")}`,
  );
});

test("a genuine cycle in the SUB-SKILL graph is reported", () => {
  const { warnings } = rule.run(
    ctxFor({
      [at("alpha")]: skill("alpha", "## REQUIRED SUB-SKILL: beta"),
      [at("beta")]: skill("beta", "## REQUIRED SUB-SKILL: alpha"),
    }),
  );
  assert.ok(
    warnings.some((w) => w.includes("cycle")),
    `got: ${warnings.join(" | ") || "(none)"}`,
  );
});

test("skills with no prose edges at all warn rather than passing vacuously", () => {
  const { warnings } = rule.run(
    ctxFor({ [at("alpha")]: skill("alpha", "No chaining here."), [at("beta")]: skill("beta", "Nor here.") }),
  );
  assert.ok(
    warnings.some((w) => w.includes("no prose chaining edges")),
    `an empty graph means UNCHECKED, not clean; got: ${warnings.join(" | ") || "(none)"}`,
  );
});

test("the live tree is coherent and its graph is non-empty", () => {
  // Guards the real corpus both ways: no stale or cyclic edges, AND the rule is actually
  // matching something. A green run over zero edges would prove nothing, which is exactly
  // how the frontmatter-sourced version stayed green while chaining nothing.
  const docs = {};
  for (const dir of readdirSync(join(REPO, "skills"))) {
    const bucket = join(REPO, "skills", dir);
    if (!statSync(bucket).isDirectory()) continue;
    for (const name of readdirSync(bucket)) {
      const p = join(bucket, name, "SKILL.md");
      if (existsSync(p)) docs[p.slice(REPO.length + 1)] = readFileSync(p, "utf8");
    }
  }
  assert.ok(Object.keys(docs).length > 0, "found no canonical skills to check");

  const { errors, warnings } = rule.run(ctxFor(docs));
  assert.deepEqual(errors, []);
  assert.deepEqual(
    warnings.filter((w) => w.includes("REQUIRED") || w.includes("cycle") || w.includes("no prose chaining edges")),
    [],
    "the shipped chain must have no stale edge, no cycle, and a non-empty graph",
  );
});
