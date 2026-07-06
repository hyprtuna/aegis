#!/usr/bin/env node
// validate-prose.mjs — scan canonical markdown prose for a conservative
// denylist of LLM-cliché terms ("slop"). Standalone; NOT wired into
// validate-structure.mjs.
//
// Scope: skills/**/*.md, agents/*.md, commands/*.md, rules/*.md, docs/*.md.
// Fenced code blocks (```...```) are stripped before matching. Matching is
// case-insensitive and whole-word/phrase.
//
// Default: WARN-ONLY — prints every hit (file:line term) and exits 0.
// --strict: exits non-zero on any hit (reserved for v0.0.7 graduation).
//
// The authoritative term list is DENYLIST below. docs/style-guide.md documents
// the same list, the rationale, and the warn→error rollout — keep them in sync.
//
// Node 20+ stdlib only. Idempotent.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Authoritative denylist (see docs/style-guide.md for rationale + levels).
// `note` is appended to a hit when the term is known-noisy / needs context.
const DENYLIST = [
  { term: "load-bearing" },
  { term: "seamless" },
  { term: "delve" },
  { term: "tapestry" },
  { term: "realm" },
  { term: "journey" },
  { term: "unleash" },
  { term: "harness the power" },
  { term: "at the end of the day" },
  { term: "it's worth noting" },
  { term: "in today's" },
  { term: "landscape", note: "common in technical prose — likely false positive" },
  { term: "robust", note: "vague intensifier — common word, warn-only" },
  { term: "leverage", note: "verb usage only; noun usage is a false positive" },
  { term: "cutting-edge" },
  { term: "moreover" },
  { term: "furthermore" },
  { term: "in summary" },
  { term: "elevate" },
  { term: "empower" },
  { term: "underscore", note: "verb usage only; literal underscore character is a false positive" },
  { term: "pivotal" },
];

const SCAN = [
  { dir: "skills", recurse: true },
  { dir: "agents", recurse: false },
  { dir: "commands", recurse: false },
  { dir: "rules", recurse: false },
  { dir: "docs", recurse: false },
];

function walk(dir, recurse, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    if (name === "node_modules" || name === "references") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (recurse) walk(full, recurse, acc);
    } else if (name.endsWith(".md")) {
      acc.push(full);
    }
  }
  return acc;
}

// Replace fenced code-block lines with blank lines so we keep line numbers but
// never match inside code. Toggles on ``` / ~~~ fences.
function blankFences(text) {
  const lines = text.split("\n");
  let inFence = false;
  let fenceMark = "";
  return lines.map((line) => {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      if (!inFence) {
        inFence = true;
        fenceMark = m[1][0];
        return "";
      }
      if (line.trimStart().startsWith(fenceMark)) {
        inFence = false;
        fenceMark = "";
        return "";
      }
    }
    return inFence ? "" : line;
  });
}

// Escape a denylist term for use inside a RegExp.
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word/phrase, case-insensitive matcher for one term. Word boundaries are
// applied at the ends that begin/end with a word char; phrases with spaces match
// across spaces literally.
function matcherFor(term) {
  const body = esc(term);
  const left = /^\w/.test(term) ? "(?<![\\w-])" : "";
  const right = /\w$/.test(term) ? "(?![\\w-])" : "";
  return new RegExp(`${left}${body}${right}`, "gi");
}

const MATCHERS = DENYLIST.map((d) => ({ ...d, re: matcherFor(d.term) }));

function main() {
  const strict = process.argv.includes("--strict");
  const files = [];
  for (const { dir, recurse } of SCAN) {
    walk(join(REPO, dir), recurse, files);
  }
  files.sort();

  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = blankFences(text);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of MATCHERS) {
        m.re.lastIndex = 0;
        if (m.re.test(line)) {
          hits.push({
            file: relative(REPO, file),
            line: i + 1,
            term: m.term,
            note: m.note,
          });
        }
      }
    }
  }

  for (const h of hits) {
    const note = h.note ? `  (${h.note})` : "";
    console.log(`${h.file}:${h.line}: ${h.term}${note}`);
  }

  const byTerm = new Map();
  for (const h of hits) byTerm.set(h.term, (byTerm.get(h.term) || 0) + 1);
  const breakdown = [...byTerm.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}=${n}`)
    .join(", ");

  console.log("");
  console.log(
    `validate-prose: ${hits.length} hit(s) across ${files.length} file(s)` +
      (breakdown ? ` — ${breakdown}` : ""),
  );

  if (hits.length === 0) {
    console.log("No denylist terms found.");
  } else if (!strict) {
    console.log("warn-only (exit 0). Run with --strict to fail on hits (v0.0.7).");
  }

  if (strict && hits.length > 0) process.exit(1);
  process.exit(0);
}

main();
