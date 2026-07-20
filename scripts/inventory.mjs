#!/usr/bin/env node
// inventory.mjs — counts canonical Aegis surfaces. Dependency-free.
// Runs in <1s on a normal repo. Soft ceiling: <5s.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = new URL("..", import.meta.url).pathname;
const start = Date.now();

function walk(dir, acc = []) {
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
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function hasFrontmatter(file) {
  try {
    const head = readFileSync(file, "utf8").slice(0, 4);
    return head.startsWith("---");
  } catch {
    return false;
  }
}

const all = walk(REPO);

const rel = (p) => relative(REPO, p);

const skills = all.filter((p) => /^skills\/[^/]+\/[^/]+\/SKILL\.md$/.test(rel(p)));
const abilities = all.filter((p) => /^skills\/[^/]+\/[^/]+\/abilities\/[^/]+\.md$/.test(rel(p)));
const languageRules = all.filter((p) => /^skills\/languages\/[^/]+\/rules\/[^/]+\.md$/.test(rel(p)));
const agents = all.filter((p) => /^agents\/[^/]+\.md$/.test(rel(p)) && !/AGENTS\.md|CLAUDE\.md/.test(rel(p)));
const commands = all.filter((p) => /^commands\/[^/]+\.md$/.test(rel(p)) && !/AGENTS\.md|CLAUDE\.md/.test(rel(p)));
const rules = all.filter((p) => /^rules\/[^/]+\.md$/.test(rel(p)) && !/AGENTS\.md|CLAUDE\.md/.test(rel(p)));
const hooks = all.filter((p) => /^hooks\/.+\.md$/.test(rel(p)) && !/AGENTS\.md|CLAUDE\.md/.test(rel(p)));
const templates = all.filter((p) => /^templates\/.+\.(md|json|html)$/.test(rel(p)) && !/\.template\.json$/.test(rel(p)) && !/AGENTS\.md|CLAUDE\.md/.test(rel(p)));
const templateManifests = all.filter((p) => /^templates\/.+\.template\.json$/.test(rel(p)));
const statuslinePresets = all.filter((p) => /^statuslines\/(?!_shared\/)[^/]+\/statusline\.json$/.test(rel(p)));
const statuslineThemes = all.filter((p) => /^statuslines\/_shared\/themes\/[^/]+\.json$/.test(rel(p)));
const statuslineSegments = all.filter((p) => /^statuslines\/_shared\/segments\/[^/]+\.mjs$/.test(rel(p)));
const adapterDocs = all.filter((p) => /^adapters\/[^/]+\/projection\.md$/.test(rel(p)));

const summary = {
  skills: skills.length,
  abilities: abilities.length,
  languageRules: languageRules.length,
  agents: agents.length,
  commands: commands.length,
  rules: rules.length,
  hooks: hooks.length,
  templates: templates.length,
  templateManifests: templateManifests.length,
  statuslinePresets: statuslinePresets.length,
  statuslineThemes: statuslineThemes.length,
  statuslineSegments: statuslineSegments.length,
  adapterProjections: adapterDocs.length,
};

const elapsedMs = Date.now() - start;

console.log(JSON.stringify({ summary, elapsedMs }, null, 2));

if (elapsedMs > 5000) {
  console.error(`Warning: inventory took ${elapsedMs}ms (>5s soft ceiling)`);
  process.exit(0);
}
