// composition.mjs — chain-coherence validator (prose-sourced).
//
// WHAT THIS RULE CHECKS
// ---------------------
// Skills chain by naming their successor IN THEIR BODY. That prose is the only chaining
// mechanism Aegis has: the projector emits no `x-aegis` key to any host, so frontmatter
// cannot route anything, and there is no runtime that reads a declared pipeline. The model
// reads the body, sees "REQUIRED SUB-SKILL: <name>", and invokes it — or does not.
//
// This rule therefore builds its graph from the body prose and asserts:
//
//   (a) ACYCLIC — no cycle in the REQUIRED SUB-SKILL graph (cycle path reported);
//   (b) EXISTENCE — every skill named by a REQUIRED SUB-SKILL / REQUIRED BACKGROUND edge
//       resolves to a real canonical skill under its current name.
//
// (b) is the load-bearing half. A stale name in the body actively misdirects the model
// toward a skill that no longer registers, which is a dead end for the user.
//
// HISTORY — why the source changed. Until v0.2.2 the graph came from an `x-aegis.pipeline`
// frontmatter block. That validated the wrong artifact: the block reached no host, so a
// skill could declare `next: foo`, never mention foo in its body, and pass green while
// chaining nothing. Worse, shipped bodies cited the block as the chaining mechanism, telling
// the model about a field that had been stripped from the file it was reading. The block and
// its `handoff` sub-key were removed; the graph now comes from the prose that actually runs.
//
// STILL VALIDATED HERE — skill INTENSITY, the surviving `x-aegis` sub-key (a genuine
// build-time authoring annotation, not a routing claim):
//
//   x-aegis:
//     intensity:
//       default: full           # one of {lite, full, ultra}; implicit 'full' if absent
//       levels: [lite, full, ultra]
//
// When present, the rule asserts `default` + every `levels` entry are drawn from the known
// set {lite, full, ultra}, that `default` is one of the declared `levels`, and that each
// declared level has a matching `### Intensity: <level>` branch in the body. A skill
// declaring no intensity block is the implicit-'full' default and is skipped.
//
// WARN-ONLY (exit 0 preserved — pushes only `warnings`), per the warn→error graduation
// convention in AGENTS.md. Note the consequence honestly: nothing this rule finds blocks a
// build, so a stale prose edge ships unless someone reads the warning.
//
// Reuses the shared ctx (ctx.files / ctx.rel / ctx.read / ctx.fmSplit) — no second
// filesystem walk. Parses the intensity block with a tiny YAML-ish reader mirroring the
// stance.mjs nested-block pattern; no YAML dependency.

export const id = "COMPOSITION";

// The bucket segment is matched structurally (`[^/]+`) rather than against an enumerated
// bucket list. An enumerated copy of that list lived in a dozen files; dissolving a bucket
// left the stale copies matching nothing, and a rule that matches nothing passes silently.

// Extract the chaining edges a skill declares IN ITS BODY.
//
// This rule used to build its graph from an `x-aegis.pipeline` frontmatter block. That block
// was removed: the projector emitted it to no host, so the graph being validated was not the
// graph any model could act on. A skill could declare `next: foo`, never mention foo in its
// body, and pass — the check was green about a mechanism that did nothing.
//
// The graph now comes from the prose, which is what actually reaches the model. Two forms,
// borrowed from the reference corpus (see docs/workflow-guide.md):
//
//   ## REQUIRED SUB-SKILL: <name>          (heading form)
//   **REQUIRED SUB-SKILL:** use `aegis:<name>`   (inline form)
//   **REQUIRED BACKGROUND:** ... `aegis:<name>`  (prerequisite knowledge, not a transition)
//
// SUB-SKILL edges are transitions and form the cycle graph. BACKGROUND edges are
// prerequisite-knowledge pointers ("you must understand X first"), NOT transitions — a skill
// naming its own upstream as BACKGROUND is correct, not a loop, so they are existence-checked
// but deliberately excluded from the cycle graph.
function parseProseEdges(body) {
  const subskills = new Set();
  const background = new Set();

  // Heading form: `## REQUIRED SUB-SKILL: <name>` (any heading depth).
  for (const m of body.matchAll(/^#{2,4}\s+REQUIRED SUB-SKILL:\s*`?(?:aegis:)?([a-z0-9-]+)`?\s*$/gim)) {
    subskills.add(m[1]);
  }

  // Inline form: `**REQUIRED SUB-SKILL:**` / `**REQUIRED BACKGROUND:**` followed by the skill
  // names cited in that PARAGRAPH (to the next blank line), not merely on the marker's own
  // line — prose wraps, and a line-scoped match silently drops an edge whose name landed on
  // the following line. A paragraph may cite alternatives ("X or Y"), so all names count.
  for (const para of body.split(/\n\s*\n/)) {
    const isSub = /\*\*REQUIRED SUB-SKILL:?\*\*/i.test(para);
    const isBg = /\*\*REQUIRED BACKGROUND:?\*\*/i.test(para);
    if (!isSub && !isBg) continue;
    for (const m of para.matchAll(/`aegis:([a-z0-9-]+)`/g)) {
      (isSub ? subskills : background).add(m[1]);
    }
  }

  if (subskills.size === 0 && background.size === 0) return null;
  return { subskills: [...subskills], background: [...background] };
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
  const { files, rel } = ctx;
  const warnings = [];

  const skillRe = new RegExp(`^skills/[^/]+/[^/]+/SKILL\\.md$`);
  const skillFiles = files.filter((p) => skillRe.test(rel(p)));

  // Pass 1: collect every canonical skill name (from frontmatter `name`) and the
  // prose chaining edges each skill declares in its body.
  const skillNames = new Set();
  const chains = []; // { name, rel, edges }

  for (const p of skillFiles) {
    const text = ctx.read(p);
    const split = ctx.fmSplit(text);
    if (split.fm === null) continue;
    const nameMatch = split.fm.match(/^name:\s*(.+?)\s*$/m);
    const name = nameMatch ? stripScalar(nameMatch[1]) : null;
    if (name) skillNames.add(name);

    const edges = parseProseEdges(split.body);
    if (edges && name) {
      chains.push({ name, rel: rel(p), edges });
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

  // Pass 2: build graph edges + run the existence check over the prose edges.
  const adj = new Map();
  const ensureNode = (n) => { if (!adj.has(n)) adj.set(n, []); };

  for (const { name, rel: r, edges } of chains) {
    ensureNode(name);

    // EXISTENCE — a prose edge must name a real canonical skill. This is the check that
    // matters most now: the body TELLS the model to invoke this name, so a stale one sends
    // the model after a skill that no longer registers.
    for (const target of edges.subskills) {
      if (!skillNames.has(target)) {
        warnings.push(
          `${r}: body declares \`REQUIRED SUB-SKILL: ${target}\`, which is not a canonical skill ` +
            `(no skills/<bucket>/${target}/SKILL.md with that name). [COMPOSITION, warn-only]`,
        );
      }
      ensureNode(target);
      adj.get(name).push(target);
    }

    for (const target of edges.background) {
      if (!skillNames.has(target)) {
        warnings.push(
          `${r}: body declares \`REQUIRED BACKGROUND\` on \`${target}\`, which is not a canonical ` +
            `skill (no skills/<bucket>/${target}/SKILL.md with that name). [COMPOSITION, warn-only]`,
        );
      }
      // Deliberately NOT a graph edge — see parseProseEdges.
    }
  }

  // VACUITY GUARD — this rule's value depends entirely on there being prose edges to check.
  // If the corpus ever stops matching (a marker gets reworded, the extractor regexes rot),
  // every check below passes over an empty graph and the rule goes green while verifying
  // nothing. Say so rather than passing quietly. Precedent: ADVERTISED_VISIBILITY.
  if (skillFiles.length > 0 && adj.size === 0) {
    warnings.push(
      `COMPOSITION parsed ${skillFiles.length} skills but found no prose chaining edges at all. ` +
        `Either no skill declares a REQUIRED SUB-SKILL / REQUIRED BACKGROUND, or the marker ` +
        `wording drifted from what this rule matches — in which case chain coherence is ` +
        `UNCHECKED, not clean. [COMPOSITION, warn-only]`,
    );
  }

  // (a) ACYCLIC — report the cycle path if any.
  const cycle = findCycle(adj);
  if (cycle) {
    warnings.push(
      `composition graph has a cycle: ${cycle.join(" → ")}. ` +
        `Break the REQUIRED SUB-SKILL edge that closes the loop. [COMPOSITION, warn-only]`,
    );
  }

  return { errors: [], warnings };
}
