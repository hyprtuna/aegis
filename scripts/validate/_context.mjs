// _context.mjs — shared validation context, built ONCE per run.
//
// Exposes a single filesystem walk + a read-through cache so rule modules never
// re-walk the tree or re-read a file (protects the 30s ceiling). No process.exit,
// no console, no deps. Node 20+ stdlib only.
//
// ctx = {
//   REPO,            // absolute repo root
//   files,           // string[] absolute paths from a single walk()
//   walk,            // the walk() fn (rules that scan a subtree reuse it)
//   rel(p),          // path relative to REPO
//   read(p),         // memoized readFileSync(p, "utf8")
//   fmSplit(text),   // { fm, body } frontmatter splitter (shared)
//   fmTopKeys(fm),   // top-level frontmatter keys
//   stripFences(t),  // text with ```...``` fenced code blocks removed
// }

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// ── Shared template helpers (AG-0147) ───────────────────────────────────────
// ONE source of truth for two things that previously lived (and diverged) in
// both scripts/validate/template-index.mjs and scripts/tests/render-templates.mjs:
//
//  1. The HTML `<!-- SLOT: key ... -->` capture regex. The key character class
//     INCLUDES `-` so hyphenated/kebab keys are captured identically by the gate
//     and the render harness (the old template-index regex excluded `-`, the old
//     render regex captured everything up to `(` including `>`; they could
//     disagree on hyphenated keys). The annotation after the key (which may carry
//     `(`, `)`, `<`, `>`) is consumed non-greedily up to `-->`.
//  2. The template-body skip-list: files under templates/{html,markdown,json}
//     that are NOT slot bodies — guidance/readme prose and the sibling slot
//     manifests. README.md is load-bearing (every family folder ships one).
//
// Both consumers import these so the gate and the render test can never diverge.

// HTML SLOT marker: capture group 1 is the key (first run of key chars, `-`
// included), then any annotation text up to the closing `-->` (non-greedy).
// Build fresh instances where the global `g` flag + lastIndex matters.
export const HTML_SLOT_KEY_CLASS = "[A-Za-z0-9_.\\[\\]-]+";
export function htmlSlotRegex() {
  return new RegExp(`<!--\\s*SLOT:\\s*(${HTML_SLOT_KEY_CLASS})[\\s\\S]*?-->`, "g");
}

// A template-body file is one that is NOT in this skip-set. Pass the bare
// basename (e.g. "default.md"). Guidance prose + sibling manifests are skipped.
const TEMPLATE_BODY_SKIP_NAMES = new Set(["AGENTS.md", "CLAUDE.md", "README.md"]);
export function isTemplateBodySkipped(basename) {
  return TEMPLATE_BODY_SKIP_NAMES.has(basename) || basename.endsWith(".template.json");
}

// Single tree walk. Same skip rules as the original monolith: skip dotfiles
// except .aegis and .claude-plugin; skip node_modules and references.
function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name.startsWith(".") && name !== ".aegis" && name !== ".claude-plugin") continue;
    if (name === "node_modules" || name === "references") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

// Small frontmatter splitter. Returns { fm: null, body: text } when there is no
// leading `---\n ... \n---` block.
function fmSplit(text) {
  if (!text.startsWith("---\n")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { fm: null, body: text };
  return { fm: text.slice(4, end), body: text.slice(end + 4) };
}

// Collect the set of top-level frontmatter keys (handles nested indented keys by
// only counting lines with zero leading whitespace).
function fmTopKeys(fm) {
  const keys = [];
  for (const line of fm.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

// Remove fenced code blocks from text. Used by prose/tool-name lints that must
// not fire on content inside code fences. Handles both ``` and ~~~ fences.
// (validate-prose.mjs ships its own line-based stripper that also tracks line
// numbers; this one is a simple non-greedy strip for the byte-level tool lint.)
function stripFences(text) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
}

// Build the shared context. REPO is the absolute repo root.
export function buildContext(REPO) {
  const files = walk(REPO);
  const cache = new Map();
  const read = (p) => {
    if (cache.has(p)) return cache.get(p);
    const text = readFileSync(p, "utf8");
    cache.set(p, text);
    return text;
  };
  const rel = (p) => relative(REPO, p);
  return { REPO, files, walk, rel, read, fmSplit, fmTopKeys, stripFences };
}
