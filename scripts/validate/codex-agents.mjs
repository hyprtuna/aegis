// codex-agents.mjs — section 10: .codex-plugin/AGENTS.md must carry an H2 heading
// for every rules/*.md filename.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const id = "CODEX_AGENTS";

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];

  const codexAgentsMd = join(REPO, ".codex-plugin/AGENTS.md");
  if (existsSync(codexAgentsMd)) {
    const agentsBody = ctx.read(codexAgentsMd);
    const rulesDir = join(REPO, "rules");
    if (existsSync(rulesDir)) {
      const ruleFiles = readdirSync(rulesDir)
        .filter((f) => f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md");
      for (const f of ruleFiles) {
        const name = f.replace(/\.md$/, "");
        const heading = `## ${name}`;
        if (!agentsBody.includes(heading)) {
          errors.push(`.codex-plugin/AGENTS.md missing H2 for rule: ${name}`);
        }
      }
    }
  }

  return { errors, warnings };
}
