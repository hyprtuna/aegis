// composition.mjs — v0.0.13: acyclic-composition validator.
//
// SCOPE — what this rule can and cannot enforce.
// ---------------------------------------------
// x-aegis is a BUILD-TIME annotation. scripts/project.mjs emits no x-aegis key to
// any host (`grep x-aegis scripts/project.mjs` → nothing), so no model on Claude,
// Codex, or anywhere else ever sees the block this rule validates. Runtime chaining
// happens through the skill BODY prose, which docs/workflow-guide.md mandates.
//
// The consequence for this rule: a green COMPOSITION run means the declared graph is
// internally coherent — no cycles, no references to skills that no longer exist. It
// does NOT mean any chain actually runs. A skill can declare `next: foo`, omit foo
// from its body entirely, and pass here. That gap is not closable from this file;
// it is why the authoring guidance (skills/AGENTS.md) puts the prose first and treats
// the block as an annotation on top of it.
//
// Skills may declare a composition block under the x-aegis namespace:
//
//   x-aegis:
//     pipeline:
//       requires: [skill-a, skill-b]   # prerequisites auto-invoked first
//       handoff: <template-kind|name>  # artifact passed forward
//       next: skill-c                  # transition target
//
// All keys are optional; absence means an atomic skill (the backward-compatible
// default). This rule builds the composition graph from every skill's
// pipeline.{requires,next} edges and asserts:
//
//   (a) ACYCLIC — no cycle in the requires/next graph (cycle path reported);
//   (b) EXISTENCE — every skill named in requires/next exists in canonical
//       under its current name;
//   (c) HANDOFF — each `handoff` resolves to a real template kind
//       (manifest/template-index.json) OR the skill body carries a `// REASON:`
//       note justifying a non-template artifact.
//
// v0.0.14 EXTENDS this rule with skill-INTENSITY validation, an
// optional extension of the same x-aegis namespace (NOT a parallel field):
//
//   x-aegis:
//     intensity:
//       default: full           # one of {lite, full, ultra}; implicit 'full' if absent
//       levels: [lite, full, ultra]
//
// When present, the rule asserts `default` + every `levels` entry are drawn from
// the known set {lite, full, ultra}, that `default` is one of the declared
// `levels`, and that each declared level has a matching `### Intensity: <level>`
// branch in the body. A skill declaring no intensity block is the implicit-'full'
// default and is skipped (no false positives).
//
// WARN-ONLY in v0.0.13 (exit 0 preserved — pushes only `warnings`), consistent
// with the v0.0.6 warn→error graduation convention (AGENTS.md). Graduates to
// hard-fail next release. If A2 seeding is correct, this rule emits NO warnings.
//
// Reuses the shared ctx (ctx.files / ctx.rel / ctx.read / ctx.fmSplit) — no
// second filesystem walk. Parses the pipeline block with a tiny YAML-ish reader
// mirroring the stance.mjs nested-block pattern; no YAML dependency.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const id = "COMPOSITION";

const SKILL_SCOPES = ["core", "languages", "workflows"];

// Parse the `x-aegis.pipeline` block out of a frontmatter string. Returns null
// when the skill declares no pipeline (atomic). Mirrors stance.mjs's nested-block
// walk: find `x-aegis:`, then `pipeline:` before the next top-level key, then read
// the pipeline's child keys (requires / handoff / next) until the block ends.
function parsePipeline(fm) {
  const lines = fm.split("\n");
  const result = { requires: [], handoff: null, next: null };
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (!/^x-aegis:\s*$/.test(lines[i])) continue;

    // Inside the x-aegis block (indented lines until next zero-indent key).
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\S/.test(lines[j])) break; // next top-level key — x-aegis block ended
      if (!/^\s+pipeline:\s*$/.test(lines[j])) continue;

      found = true;
      const pipelineIndent = lines[j].match(/^(\s+)/)[1].length;

      // Read pipeline children: lines indented deeper than `pipeline:`.
      for (let k = j + 1; k < lines.length; k++) {
        if (/^\S/.test(lines[k])) break; // back to top-level — done
        const childIndent = (lines[k].match(/^(\s*)/)[1] || "").length;
        if (lines[k].trim() === "") continue;
        if (childIndent <= pipelineIndent) break; // sibling/parent key — pipeline ended

        const mNext = lines[k].match(/^\s+next:\s*(.+?)\s*$/);
        if (mNext) { result.next = stripScalar(mNext[1]); continue; }

        const mHandoff = lines[k].match(/^\s+handoff:\s*(.+?)\s*$/);
        if (mHandoff) { result.handoff = stripScalar(mHandoff[1]); continue; }

        // requires: inline array [a, b] OR block list of `- item` lines.
        const mReqInline = lines[k].match(/^\s+requires:\s*\[(.*)\]\s*$/);
        if (mReqInline) {
          result.requires = mReqInline[1]
            .split(",")
            .map((s) => stripScalar(s.trim()))
            .filter(Boolean);
          continue;
        }
        const mReqEmpty = lines[k].match(/^\s+requires:\s*$/);
        if (mReqEmpty) {
          // Block-list form: subsequent `- item` lines deeper-indented.
          for (let m = k + 1; m < lines.length; m++) {
            const item = lines[m].match(/^\s+-\s*(.+?)\s*$/);
            if (!item) break;
            result.requires.push(stripScalar(item[1]));
            k = m;
          }
          continue;
        }
      }
      break; // handled the pipeline block
    }
    if (found) break;
  }

  return found ? result : null;
}

// Strip surrounding quotes from a YAML scalar.
function stripScalar(s) {
  return s.replace(/^['"]|['"]$/g, "").trim();
}

const KNOWN_INTENSITY = new Set(["lite", "full", "ultra"]);

// Parse the `x-aegis.intensity` block out of a frontmatter string. Returns null
// when the skill declares no intensity block (the backward-compatible implicit
// 'full' default). Mirrors parsePipeline's nested-block walk: find `x-aegis:`,
// then `intensity:` before the next top-level key, then read its child keys
// (default / levels) until the block ends. Reads inline `levels: [a, b]` and the
// block-list `- item` form.
function parseIntensity(fm) {
  const lines = fm.split("\n");
  const result = { default: null, levels: [] };
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (!/^x-aegis:\s*$/.test(lines[i])) continue;

    for (let j = i + 1; j < lines.length; j++) {
      if (/^\S/.test(lines[j])) break; // next top-level key — x-aegis block ended
      if (!/^\s+intensity:\s*$/.test(lines[j])) continue;

      found = true;
      const blockIndent = lines[j].match(/^(\s+)/)[1].length;

      for (let k = j + 1; k < lines.length; k++) {
        if (/^\S/.test(lines[k])) break; // back to top-level — done
        if (lines[k].trim() === "") continue;
        const childIndent = (lines[k].match(/^(\s*)/)[1] || "").length;
        if (childIndent <= blockIndent) break; // sibling/parent key — intensity ended

        const mDefault = lines[k].match(/^\s+default:\s*(.+?)\s*$/);
        if (mDefault) { result.default = stripScalar(mDefault[1]); continue; }

        const mLevelsInline = lines[k].match(/^\s+levels:\s*\[(.*)\]\s*$/);
        if (mLevelsInline) {
          result.levels = mLevelsInline[1]
            .split(",")
            .map((s) => stripScalar(s.trim()))
            .filter(Boolean);
          continue;
        }
        const mLevelsEmpty = lines[k].match(/^\s+levels:\s*$/);
        if (mLevelsEmpty) {
          for (let m = k + 1; m < lines.length; m++) {
            const item = lines[m].match(/^\s+-\s*(.+?)\s*$/);
            if (!item) break;
            result.levels.push(stripScalar(item[1]));
            k = m;
          }
          continue;
        }
      }
      break; // handled the intensity block
    }
    if (found) break;
  }

  return found ? result : null;
}

// Load the set of template kinds from manifest/template-index.json (read once).
function loadTemplateKinds(REPO) {
  try {
    const text = readFileSync(join(REPO, "manifest", "template-index.json"), "utf8");
    const json = JSON.parse(text);
    return new Set(Object.keys(json.kinds || {}));
  } catch {
    return new Set();
  }
}

// Detect a cycle in a directed graph (adjacency map name -> string[]).
// Returns the cycle path (array of node names) or null if acyclic.
function findCycle(adj) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const n of adj.keys()) color.set(n, WHITE);
  const stack = [];

  function dfs(node) {
    color.set(node, GRAY);
    stack.push(node);
    for (const nxt of adj.get(node) || []) {
      if (!adj.has(nxt)) continue; // edge to a non-graph node — existence check covers it
      const c = color.get(nxt);
      if (c === GRAY) {
        // Cycle: from nxt's position in the stack to the end, plus nxt to close.
        const idx = stack.indexOf(nxt);
        return [...stack.slice(idx), nxt];
      }
      if (c === WHITE) {
        const found = dfs(nxt);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const n of adj.keys()) {
    if (color.get(n) === WHITE) {
      const cyc = dfs(n);
      if (cyc) return cyc;
    }
  }
  return null;
}

export function run(ctx) {
  const { files, rel, REPO } = ctx;
  const warnings = [];

  const skillRe = new RegExp(`^skills/(${SKILL_SCOPES.join("|")})/[^/]+/SKILL\\.md$`);
  const skillFiles = files.filter((p) => skillRe.test(rel(p)));

  // Pass 1: collect every canonical skill name (from frontmatter `name`) and the
  // pipeline block per skill that declares one.
  const skillNames = new Set();
  const pipelines = []; // { name, rel, pipeline, body }

  for (const p of skillFiles) {
    const text = ctx.read(p);
    const split = ctx.fmSplit(text);
    if (split.fm === null) continue;
    const nameMatch = split.fm.match(/^name:\s*(.+?)\s*$/m);
    const name = nameMatch ? stripScalar(nameMatch[1]) : null;
    if (name) skillNames.add(name);

    const pipeline = parsePipeline(split.fm);
    if (pipeline && name) {
      pipelines.push({ name, rel: rel(p), pipeline, body: split.body });
    }

    // INTENSITY — validate the optional x-aegis.intensity block when
    // present. A skill that declares none is the implicit-'full' default and is
    // skipped entirely (no false positives). Warn-only, like the rest of this rule.
    const intensity = parseIntensity(split.fm);
    if (intensity) {
      const r = rel(p);
      for (const lvl of intensity.levels) {
        if (!KNOWN_INTENSITY.has(lvl)) {
          warnings.push(
            `${r}: x-aegis.intensity.levels names \`${lvl}\`, which is not a known intensity level ` +
              `(expected one of lite, full, ultra). [COMPOSITION, warn-only]`,
          );
        }
      }
      if (intensity.default !== null && !KNOWN_INTENSITY.has(intensity.default)) {
        warnings.push(
          `${r}: x-aegis.intensity.default is \`${intensity.default}\`, which is not a known intensity level ` +
            `(expected one of lite, full, ultra). [COMPOSITION, warn-only]`,
        );
      }
      if (
        intensity.default !== null &&
        intensity.levels.length > 0 &&
        !intensity.levels.includes(intensity.default)
      ) {
        warnings.push(
          `${r}: x-aegis.intensity.default \`${intensity.default}\` is not one of the declared levels ` +
            `[${intensity.levels.join(", ")}]. [COMPOSITION, warn-only]`,
        );
      }
      // A declared level must have a matching branch in the body. Bodies mark a
      // branch with an `### Intensity: <level>` heading (the documented shape).
      for (const lvl of intensity.levels) {
        if (!KNOWN_INTENSITY.has(lvl)) continue; // already warned above
        const branchRe = new RegExp(`^#{2,4}\\s+Intensity:\\s+${lvl}\\b`, "mi");
        if (!branchRe.test(split.body)) {
          warnings.push(
            `${r}: x-aegis.intensity declares level \`${lvl}\` but the body has no ` +
              `\`### Intensity: ${lvl}\` branch. [COMPOSITION, warn-only]`,
          );
        }
      }
    }
  }

  const templateKinds = loadTemplateKinds(REPO);

  // Pass 2: build graph edges + run existence + handoff checks.
  const adj = new Map();
  const ensureNode = (n) => { if (!adj.has(n)) adj.set(n, []); };

  for (const { name, rel: r, pipeline, body } of pipelines) {
    ensureNode(name);

    // (b) EXISTENCE — requires + next must name a real canonical skill.
    for (const req of pipeline.requires) {
      if (!skillNames.has(req)) {
        warnings.push(
          `${r}: x-aegis.pipeline.requires names \`${req}\`, which is not a canonical skill ` +
            `(no skills/{core,languages,workflows}/${req}/SKILL.md with that name). [COMPOSITION, warn-only]`,
        );
      }
      // Edge: prerequisite -> this skill (the prereq runs first).
      ensureNode(req);
      adj.get(req).push(name);
    }

    if (pipeline.next) {
      if (!skillNames.has(pipeline.next)) {
        warnings.push(
          `${r}: x-aegis.pipeline.next names \`${pipeline.next}\`, which is not a canonical skill ` +
            `(no skills/{core,languages,workflows}/${pipeline.next}/SKILL.md with that name). [COMPOSITION, warn-only]`,
        );
      }
      // Edge: this skill -> next.
      ensureNode(pipeline.next);
      adj.get(name).push(pipeline.next);
    }

    // (c) HANDOFF — must be a real template kind or carry a `// REASON:` note.
    if (pipeline.handoff && !templateKinds.has(pipeline.handoff)) {
      if (!body.includes("// REASON:")) {
        warnings.push(
          `${r}: x-aegis.pipeline.handoff names \`${pipeline.handoff}\`, which is not a template kind ` +
            `in manifest/template-index.json and the body carries no \`// REASON:\` note. ` +
            `Name a real template kind or justify with a \`// REASON:\`. [COMPOSITION, warn-only]`,
        );
      }
    }
  }

  // (a) ACYCLIC — report the cycle path if any.
  const cycle = findCycle(adj);
  if (cycle) {
    warnings.push(
      `composition graph has a cycle: ${cycle.join(" → ")}. ` +
        `Break the requires/next edge that closes the loop. [COMPOSITION, warn-only]`,
    );
  }

  return { errors: [], warnings };
}
