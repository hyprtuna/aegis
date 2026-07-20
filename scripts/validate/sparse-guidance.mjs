// sparse-guidance.mjs — sections 2, 3, 4: AGENTS.md/CLAUDE.md placement, depth,
// every approved folder has AGENTS.md, and CLAUDE.md stubs import AGENTS.md.
import { existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

export const id = "SPARSE_GUIDANCE";

// Approved guidance folders (must mirror manifest/aegis.manifest.json guidanceFolders).
// agents/ and commands/ are intentionally EXCLUDED: Claude Code's plugin loader
// scans every .md in those folders and would register AGENTS.md/CLAUDE.md as
// agents/commands. Their guidance lives in root AGENTS.md instead.
const APPROVED_GUIDANCE = new Set([
  ".",
  "adapters",
  "docs",
  "hooks",
  "manifest",
  "rules",
  "scripts",
  "skills",
  "statuslines",
  "templates",
]);

export function run(ctx) {
  const { REPO, files } = ctx;
  const errors = [];
  const warnings = [];

  // 2. Sparse guidance: every AGENTS.md/CLAUDE.md lives in an approved folder.
  const guidance = files.filter((p) => /(?:^|\/)(?:AGENTS|CLAUDE)\.md$/.test(p));
  for (const g of guidance) {
    const rel = relative(REPO, g);
    const parentDir = dirname(rel) === "" ? "." : dirname(rel).split("/")[0];
    if (!APPROVED_GUIDANCE.has(parentDir)) {
      errors.push(`guidance file in unapproved folder: ${rel}`);
    }
    // No nested guidance: must be directly in the approved root, not deeper.
    const depth = dirname(rel) === "." ? 0 : dirname(rel).split("/").length;
    if (depth > 1) {
      errors.push(`nested guidance file (depth ${depth}, max 1): ${rel}`);
    }
  }

  // 3. Every approved guidance folder that exists must have AGENTS.md.
  for (const folder of APPROVED_GUIDANCE) {
    const full = folder === "." ? REPO : join(REPO, folder);
    if (!existsSync(full)) continue;
    if (!existsSync(join(full, "AGENTS.md"))) errors.push(`missing AGENTS.md in: ${folder}/`);
  }

  // 4. CLAUDE.md stubs must import AGENTS.md.
  for (const g of guidance.filter((p) => p.endsWith("CLAUDE.md"))) {
    const body = ctx.read(g).trim();
    if (body !== "@./AGENTS.md") {
      errors.push(`CLAUDE.md is not a 1-line @./AGENTS.md stub: ${relative(REPO, g)}`);
    }
  }

  return { errors, warnings };
}
