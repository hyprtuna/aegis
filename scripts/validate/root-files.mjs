// root-files.mjs — section 1: required root files exist.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const id = "ROOT_FILES";

const REQUIRED_ROOT = ["README.md", "CONTRIBUTING.md", "AGENTS.md", "CLAUDE.md", "CHANGELOG.md", "package.json"];

export function run(ctx) {
  const errors = [];
  const warnings = [];
  for (const f of REQUIRED_ROOT) {
    if (!existsSync(join(ctx.REPO, f))) errors.push(`missing required root file: ${f}`);
  }
  return { errors, warnings };
}
