// collision-names.mjs — name-collision + reserved-name helpers (A1), consumed by A4.
//
// Surfaces register under a flat name namespace on most hosts: a skill, an agent,
// and a command sharing one name collide. This module enumerates names across
// skills/, agents/, and commands/, finds cross-surface duplicates, and checks
// against a reserved-name set. Node 20+ stdlib only. No deps. Pure (no I/O side
// effects beyond reads; no process.exit, no console).

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { skillScopes } from "./skill-scopes.mjs";

// Names hosts reserve / that would shadow built-ins. Extend as A4 requires.
export const RESERVED_NAMES = new Set([
  "skill",
  "agent",
  "command",
  "help",
  "init",
]);

// Parse the `name:` value from a leading frontmatter block. Returns null when
// there is no parseable frontmatter or no name key.
function nameFromFrontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const fm = text.slice(4, end);
  const m = fm.match(/^name:\s*(.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// Agent names from agents/*.md (parse name:, fall back to filename stem).
// Returns Array<{ name, file }> (file is repo-relative).
export function collectAgentNames(REPO) {
  const out = [];
  const dir = join(REPO, "agents");
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    if (f === "AGENTS.md" || f === "CLAUDE.md") continue;
    const text = readFileSync(join(dir, f), "utf8");
    const name = nameFromFrontmatter(text) || f.replace(/\.md$/, "");
    out.push({ name, file: `agents/${f}` });
  }
  return out;
}

// Skill names from skills/<scope>/<name>/SKILL.md (parse name:, fall back to the
// folder name). Returns Array<{ name, file }>.
export function collectSkillNames(REPO) {
  const out = [];
  const skillsDir = join(REPO, "skills");
  if (!existsSync(skillsDir)) return out;
  for (const scope of skillScopes(REPO)) {
    const scopeDir = join(skillsDir, scope);
    if (!existsSync(scopeDir)) continue;
    for (const entry of readdirSync(scopeDir)) {
      const skillDir = join(scopeDir, entry);
      let st;
      try { st = statSync(skillDir); } catch { continue; }
      if (!st.isDirectory()) continue;
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const text = readFileSync(skillFile, "utf8");
      const name = nameFromFrontmatter(text) || entry;
      out.push({ name, file: `skills/${scope}/${entry}/SKILL.md` });
    }
  }
  return out;
}

// Command names from commands/*.md (parse name:, fall back to filename stem).
// Returns Array<{ name, file }>.
export function collectCommandNames(REPO) {
  const out = [];
  const dir = join(REPO, "commands");
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    if (f === "AGENTS.md" || f === "CLAUDE.md") continue;
    const text = readFileSync(join(dir, f), "utf8");
    const name = nameFromFrontmatter(text) || f.replace(/\.md$/, "");
    out.push({ name, file: `commands/${f}` });
  }
  return out;
}

// All named surfaces across skills/ + agents/ + commands/, each tagged with its
// surface kind. Returns Array<{ name, surface, file }>.
export function collectAllSurfaceNames(REPO) {
  return [
    ...collectSkillNames(REPO).map((e) => ({ ...e, surface: "skill" })),
    ...collectAgentNames(REPO).map((e) => ({ ...e, surface: "agent" })),
    ...collectCommandNames(REPO).map((e) => ({ ...e, surface: "command" })),
  ];
}

// Find names claimed by more than one surface (across skills/agents/commands).
// Returns Array<{ name, occurrences: Array<{ surface, file }> }>, sorted by name.
// Two surfaces of different kinds sharing a name is a collision; so is the same
// name appearing twice within one kind.
export function findNameCollisions(REPO) {
  const byName = new Map();
  for (const entry of collectAllSurfaceNames(REPO)) {
    if (!byName.has(entry.name)) byName.set(entry.name, []);
    byName.get(entry.name).push({ surface: entry.surface, file: entry.file });
  }
  const collisions = [];
  for (const [name, occurrences] of byName) {
    if (occurrences.length > 1) collisions.push({ name, occurrences });
  }
  collisions.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return collisions;
}

// Names that collide with the reserved set. Returns Array<{ name, surface, file }>.
export function findReservedNameHits(REPO, reserved = RESERVED_NAMES) {
  const hits = [];
  for (const entry of collectAllSurfaceNames(REPO)) {
    if (reserved.has(entry.name)) hits.push(entry);
  }
  return hits;
}
