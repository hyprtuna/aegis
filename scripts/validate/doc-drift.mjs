// doc-drift.mjs — doc-drift validator.
//
// Folds the standalone `scripts/validate-counts.mjs` surface-count drift logic
// into the single-walk validator pass and adds an internal/references dead-link
// check. Rides the shared ctx — NO second filesystem walk, NO re-reads. The one
// allowed shell-out is to `inventory.mjs` for the count truth (matching the
// standalone's pattern); counts cannot be derived from ctx.files alone.
//
// THREE checks, by stage:
//   B1 COUNT DRIFT  — HARD-FAIL (error). Numeric "<n> <surface>" claims in
//                     README.md, root AGENTS.md, docs/architecture.md, AND
//                     .claude-plugin/plugin.json must match the live inventory.
//   B2 DEAD LINKS   — HARD-FAIL (error) for broken repo-internal / references
//                     markdown links in canonical prose. External (http) and
//                     anchor-only links are skipped.
//   B3 OVERSIZE     — NOT handled here. `SKILL_BODY_LONG`
//                     (scripts/validate/skill-body-long.mjs) owns the >100-line
//                     skill-body WARN; re-flagging it here would double-warn.
//                     See docs/validators.md.
//
// DECISION (B1) — validate-counts.mjs is RETAINED as a thin standalone shim, not
// retired: it stays a separately-runnable CI/maintainer gate (documented in
// scripts/AGENTS.md and docs/validators.md, and referenced in workflows). DOC_DRIFT
// is the in-pass owner of the same drift contract; the two share the inventory
// truth source so they cannot disagree.
//
// references/-is-read-only law: link existence is checked, file contents are
// NEVER read. references/ is EXCLUDED from the shared walk (and is not even
// materialized in git worktrees), so a references/-relative target is resolved
// with an explicit existsSync against the repo root — and, when the references/
// directory itself is absent (worktree / unmaterialized), the link is treated as
// UNVERIFIABLE and skipped rather than false-flagged broken.
export const id = "DOC_DRIFT";

import { existsSync } from "node:fs";
import { join, dirname, resolve, normalize } from "node:path";
import { execFileSync } from "node:child_process";

// ---- B1: count drift ------------------------------------------------------

const SURFACE = [
  { word: "skill", key: "skills" },
  { word: "abilit", key: "abilities" },
  { word: "agent", key: "agents" },
  { word: "command", key: "commands" },
  { word: "rule", key: "rules" },
  { word: "hook", key: "hooks" },
  { word: "template", key: "templates" },
];

const ALLOWED_WORDS = {
  skill: ["skill", "skills"],
  abilit: ["ability", "abilities"],
  agent: ["agent", "agents"],
  command: ["command", "commands"],
  rule: ["rule", "rules"],
  hook: ["hook", "hooks"],
  template: ["template", "templates"],
};

const COUNT_DOCS = [
  "README.md",
  "AGENTS.md",
  join("docs", "architecture.md"),
  join(".claude-plugin", "plugin.json"),
];

function liveCounts(REPO) {
  const out = execFileSync("node", [join(REPO, "scripts", "inventory.mjs")], {
    encoding: "utf8",
  });
  return JSON.parse(out).summary;
}

// Line-based fenced-code stripper (claim/link matching must skip code blocks).
function stripFenceLines(text) {
  const lines = text.split("\n");
  let inFence = false;
  let mark = "";
  return lines.map((line) => {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      if (!inFence) {
        inFence = true;
        mark = m[1][0];
        return "";
      }
      if (line.trimStart().startsWith(mark)) {
        inFence = false;
        mark = "";
        return "";
      }
    }
    return inFence ? "" : line;
  });
}

function findClaims(rawLine, lineNo, file) {
  const line = rawLine.replace(/[*_]/g, "");
  const claims = [];
  for (const { word, key } of SURFACE) {
    const re = new RegExp(`(~?)(\\d{1,4})\\s+(${word}\\w*)`, "gi");
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m[1] === "~") continue; // approximate design cap, not a count claim
      const matched = m[3].toLowerCase();
      if (!(ALLOWED_WORDS[word] || []).includes(matched)) continue;
      claims.push({ file, line: lineNo, key, claimed: Number(m[2]), text: m[0].trim() });
    }
  }
  return claims;
}

function countDrift(ctx) {
  const errors = [];
  const live = liveCounts(ctx.REPO);
  for (const doc of COUNT_DOCS) {
    const path = join(ctx.REPO, doc);
    if (!existsSync(path)) continue;
    const lines = stripFenceLines(ctx.read(path));
    lines.forEach((line, i) => {
      for (const c of findClaims(line, i + 1, doc)) {
        const actual = live[c.key];
        if (actual !== c.claimed) {
          errors.push(
            `DOC_DRIFT: ${c.file}:${c.line} claims ${c.claimed} ${c.key}, live inventory is ${actual} — "${c.text}". Fix the doc to match \`node scripts/inventory.mjs\`. [DOC_DRIFT]`,
          );
        }
      }
    });
  }
  return errors;
}

// ---- B2: dead links -------------------------------------------------------

// Canonical-prose roots only (NOT generated trees: adapters/<host> generated
// dirs, .codex/, .opencode/, .claude-plugin generated bodies). Scoping keeps the
// scan small for the <30s ceiling.
const PROSE_FILE_RE = /^(README\.md|AGENTS\.md|CONTRIBUTING\.md|CHANGELOG\.md)$/;
const PROSE_DIR_RE = /^(docs|rules|skills|agents|commands|hooks|templates|statuslines|\.aegis)\//;

function isProse(rel) {
  return rel.endsWith(".md") && (PROSE_FILE_RE.test(rel) || PROSE_DIR_RE.test(rel));
}

// Markdown inline links: [text](target). Capture target up to ) ignoring titles.
const LINK_RE = /\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

function deadLinks(ctx) {
  const errors = [];
  const fileSet = new Set(ctx.files.map((p) => ctx.rel(p)));
  const referencesDirExists = existsSync(join(ctx.REPO, "references"));

  const proseFiles = ctx.files.filter((p) => isProse(ctx.rel(p)));

  for (const p of proseFiles) {
    const rel = ctx.rel(p);
    const fileDir = dirname(rel);
    const lines = stripFenceLines(ctx.read(p));
    lines.forEach((line, i) => {
      let m;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(line)) !== null) {
        let target = m[1].trim();
        // Skip external, mailto, anchors, and protocol-relative links.
        if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, mailto:, etc.
        if (target.startsWith("#")) continue; // in-page anchor
        if (target.startsWith("//")) continue; // protocol-relative
        // Drop any in-target anchor / query for resolution.
        const cleanTarget = target.replace(/[#?].*$/, "");
        if (cleanTarget === "") continue; // pure anchor

        // Resolve relative to the linking file's directory (repo-relative).
        const resolvedRel = normalize(join(fileDir, cleanTarget));
        // Reject upward escapes out of the repo (treat as unverifiable).
        if (resolvedRel.startsWith("..")) continue;

        const isReferences = resolvedRel === "references" || resolvedRel.startsWith("references/");
        if (isReferences) {
          // references/ is excluded from the walk and may be unmaterialized in a
          // worktree. Only flag when the references/ dir IS present but the
          // specific target is missing; otherwise skip as unverifiable. Existence
          // only — contents are never read (read-only law).
          if (!referencesDirExists) continue; // unverifiable, skip
          if (!existsSync(join(ctx.REPO, resolvedRel))) {
            errors.push(
              `DOC_DRIFT: ${rel}:${i + 1} broken references link → "${target}" (resolves to ${resolvedRel}, missing). [DOC_DRIFT]`,
            );
          }
          continue;
        }

        // Repo-internal link: in-memory membership against the shared walk.
        // Accept either a file match or a directory match (link to a folder).
        if (fileSet.has(resolvedRel)) continue;
        const asDir = resolvedRel.endsWith("/") ? resolvedRel.slice(0, -1) : resolvedRel;
        const isDir = ctx.files.some(
          (fp) => ctx.rel(fp).startsWith(asDir + "/"),
        );
        if (isDir) continue;
        errors.push(
          `DOC_DRIFT: ${rel}:${i + 1} broken internal link → "${target}" (resolves to ${resolvedRel}, not found). [DOC_DRIFT]`,
        );
      }
    });
  }
  return errors;
}

// ---------------------------------------------------------------------------

export function run(ctx) {
  const errors = [];
  for (const e of countDrift(ctx)) errors.push(e);
  for (const e of deadLinks(ctx)) errors.push(e);
  // B3 oversize: intentionally NOT emitted here — owned by SKILL_BODY_LONG.
  return { errors, warnings: [] };
}
