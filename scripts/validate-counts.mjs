#!/usr/bin/env node
// validate-counts.mjs — verify surface-count claims in human docs match the
// live inventory. Standalone gate; HARD-FAILS (exit 1) on any drift.
//
// Sources scanned: README.md, root AGENTS.md, docs/architecture.md.
// Truth: `node scripts/inventory.mjs` JSON (we shell out, never re-walk).
//
// A "count claim" is a number adjacent to a surface keyword, e.g. "79 skills",
// "18 agents", "12 rules". Approximate caps written with a tilde ("~15
// commands") are NOT claims and are ignored — they are design caps, not counts.
//
// Node 20+ stdlib only. Idempotent.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Map a surface keyword (singular stem) to the inventory summary key.
const SURFACE = [
  { word: "skill", key: "skills" },
  { word: "abilit", key: "abilities" }, // ability / abilities
  // `rules/` overlays nested inside an abilities tree are counted separately from prose
  // ability fragments (see inventory.mjs), so they need their own gated claim word. The
  // stem is hyphenated on purpose: a bare "rule" would collide with the `rules` key and
  // read "28 language rules" as a drifted claim about the 18 top-level rules.
  { word: "language-rule", key: "languageRules" },
  { word: "agent", key: "agents" },
  { word: "command", key: "commands" },
  { word: "rule", key: "rules" },
  { word: "hook", key: "hooks" },
  { word: "template", key: "templates" },
];

const DOCS = ["README.md", "AGENTS.md", join("docs", "architecture.md")];

function liveCounts() {
  const out = execFileSync("node", [join(REPO, "scripts", "inventory.mjs")], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(out);
  return parsed.summary;
}

function stripFences(text) {
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

// Find "<number> <surface-word>" claims on a line. Skips tilde-prefixed
// approximate caps ("~15 commands") and percentages.
function findClaims(rawLine, lineNo, file) {
  // Strip markdown emphasis markers so a bolded count like "**79** skills"
  // (or "__79__ agents") still reads as the adjacent claim "79 skills".
  const line = rawLine.replace(/[*_]/g, "");
  const claims = [];
  for (const { word, key } of SURFACE) {
    // number, optional whitespace, the surface word as a whole word, optional
    // plural 's' or 'ies' suffix already covered by the stem match.
    const re = new RegExp(`(~?)(\\d{1,4})\\s+(${word}\\w*)`, "gi");
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m[1] === "~") continue; // approximate cap, not a count claim
      // Only treat real surface plurals/singulars, not e.g. "agentic".
      const matchedWord = m[3].toLowerCase();
      if (!isSurfaceWord(matchedWord, word)) continue;
      claims.push({
        file,
        line: lineNo,
        key,
        claimed: Number(m[2]),
        text: m[0].trim(),
      });
    }
  }
  return claims;
}

// Guard against partial-word matches like "agentic" or "ruler".
function isSurfaceWord(matched, stem) {
  const allowed = {
    skill: ["skill", "skills"],
    abilit: ["ability", "abilities"],
    agent: ["agent", "agents"],
    command: ["command", "commands"],
    rule: ["rule", "rules"],
    "language-rule": ["language-rule", "language-rules"],
    hook: ["hook", "hooks"],
    template: ["template", "templates"],
  };
  return (allowed[stem] || []).includes(matched);
}

function main() {
  const live = liveCounts();
  const allClaims = [];

  for (const doc of DOCS) {
    const path = join(REPO, doc);
    if (!existsSync(path)) continue;
    const lines = stripFences(readFileSync(path, "utf8"));
    lines.forEach((line, i) => {
      for (const c of findClaims(line, i + 1, doc)) allClaims.push(c);
    });
  }

  const drift = [];
  for (const c of allClaims) {
    const actual = live[c.key];
    if (actual !== c.claimed) {
      drift.push({ ...c, actual });
    }
  }

  console.log(
    `validate-counts: checked ${allClaims.length} count claim(s) in ${DOCS.length} doc(s)`,
  );
  for (const c of allClaims) {
    const status = c.claimed === live[c.key] ? "ok" : "DRIFT";
    console.log(
      `  [${status}] ${c.file}:${c.line} claims ${c.claimed} ${c.key} (live=${live[c.key]}) — "${c.text}"`,
    );
  }

  // PER-KEY COVERAGE — a surface whose claims all stop matching is indistinguishable from a
  // surface with no drift: both contribute zero entries to `drift`. That is how this release's
  // headline "126 abilities" went ungated (phrased so the number and the word were not
  // adjacent) while the run still printed a clean bill. Warn per key rather than only
  // reporting total claim loss.
  const claimedKeys = new Set(allClaims.map((c) => c.key));
  const uncovered = SURFACE.map((s) => s.key).filter((k) => !claimedKeys.has(k));
  if (uncovered.length > 0) {
    console.log("");
    for (const key of uncovered) {
      console.log(
        `  [warn] no count claim found for '${key}' (live=${live[key]}) — ` +
          `this surface's count is UNGATED. Either state it in ${DOCS.join(" / ")} with the ` +
          `number adjacent to the surface word ("${live[key]} ${key}"), or drop it from SURFACE.`,
      );
    }
  }

  if (drift.length > 0) {
    console.error("");
    console.error(`DRIFT: ${drift.length} stale count claim(s):`);
    for (const d of drift) {
      console.error(
        `  ${d.file}:${d.line}: claims ${d.claimed} ${d.key}, live inventory is ${d.actual}`,
      );
    }
    console.error("Fix the doc counts to match `node scripts/inventory.mjs`.");
    process.exit(1);
  }

  if (allClaims.length === 0) {
    console.log("No numeric surface-count claims found — nothing to drift.");
  } else {
    console.log("All count claims match live inventory ✓");
  }
  process.exit(0);
}

main();
