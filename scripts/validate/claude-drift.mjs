// claude-drift.mjs — v0.0.5 pass D (DH4/DH5): STRUCTURAL Claude-tree drift.
// project.mjs is NEVER imported here: it executes its CLI on import, so drift is
// checked structurally only.
//
// HONEST LIMITATION (DH5 fallback): this pass detects structural drift — missing or
// extra generated files, dangling plugin.json paths, unresolved ${TEMPLATE:} tokens,
// and forbidden/leftover frontmatter keys. It does NOT detect body-content drift
// (someone hand-editing the BODY of a generated SKILL.md or agent .md so it diverges
// from canonical). Full body-content drift detection requires re-running the projector
// in-memory, which is unsafe here because project.mjs executes its CLI on import.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const id = "CLAUDE_DRIFT";

export function run(ctx) {
  const { REPO, walk, fmSplit, fmTopKeys } = ctx;
  const errors = [];
  const warnings = [];

  const claudeRoot = join(REPO, "adapters/claude");

  // D1. Skill count + name parity per scope.
  for (const scope of ["core", "languages", "workflows"]) {
    const canonScope = join(REPO, "skills", scope);
    const genScope = join(claudeRoot, "skills", scope);
    const canonNames = new Set();
    const genNames = new Set();
    if (existsSync(canonScope)) {
      for (const entry of readdirSync(canonScope)) {
        const sk = join(canonScope, entry, "SKILL.md");
        if (existsSync(sk)) canonNames.add(entry);
      }
    }
    if (existsSync(genScope)) {
      for (const entry of readdirSync(genScope)) {
        const sk = join(genScope, entry, "SKILL.md");
        if (existsSync(sk)) genNames.add(entry);
      }
    }
    for (const n of canonNames) {
      if (!genNames.has(n)) {
        errors.push(`claude-drift: canonical skill skills/${scope}/${n}/SKILL.md has no generated adapters/claude/skills/${scope}/${n}/SKILL.md`);
      }
    }
    for (const n of genNames) {
      if (!canonNames.has(n)) {
        errors.push(`claude-drift: generated skill adapters/claude/skills/${scope}/${n}/SKILL.md has no canonical skills/${scope}/${n}/SKILL.md`);
      }
    }
  }

  // D2. Agent parity (canonical <-> generated).
  const canonAgents = new Set();
  const genAgents = new Set();
  const canonAgentsDir = join(REPO, "agents");
  const genAgentsDir = join(claudeRoot, "agents");
  if (existsSync(canonAgentsDir)) {
    for (const f of readdirSync(canonAgentsDir)) {
      if (f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md") canonAgents.add(f);
    }
  }
  if (existsSync(genAgentsDir)) {
    for (const f of readdirSync(genAgentsDir)) {
      if (f.endsWith(".md") && f !== "AGENTS.md" && f !== "CLAUDE.md") genAgents.add(f);
    }
  }
  for (const f of canonAgents) {
    if (!genAgents.has(f)) errors.push(`claude-drift: canonical agent agents/${f} has no generated adapters/claude/agents/${f}`);
  }
  for (const f of genAgents) {
    if (!canonAgents.has(f)) errors.push(`claude-drift: generated agent adapters/claude/agents/${f} has no canonical agents/${f}`);
  }

  // D3. Every plugin.json skills/agents path resolves.
  const pluginJsonPath = join(REPO, ".claude-plugin/plugin.json");
  if (existsSync(pluginJsonPath)) {
    let pj;
    try {
      pj = JSON.parse(ctx.read(pluginJsonPath));
    } catch (e) {
      errors.push(`.claude-plugin/plugin.json invalid JSON: ${e.message}`);
    }
    if (pj) {
      const resolvePluginPath = (p) => join(REPO, p.replace(/^\.\//, ""));
      for (const sp of Array.isArray(pj.skills) ? pj.skills : []) {
        const full = resolvePluginPath(sp);
        // AG-0256: skills entries are BUCKET ROOTS. Claude scans each one level
        // deep for <name>/SKILL.md, so a valid bucket is a directory that holds
        // at least one such child. (A per-skill dir with a direct SKILL.md would
        // register nothing under Claude's scan, so it is NOT accepted here.)
        if (!existsSync(full)) {
          errors.push(`claude-drift: plugin.json skills path does not resolve: ${sp}`);
          continue;
        }
        try {
          if (!statSync(full).isDirectory()) {
            errors.push(`claude-drift: plugin.json skills path is not a directory: ${sp}`);
            continue;
          }
          const hasSkillChild = readdirSync(full).some((child) =>
            existsSync(join(full, child, "SKILL.md")),
          );
          if (!hasSkillChild) {
            errors.push(`claude-drift: plugin.json skills bucket has no <name>/SKILL.md child (Claude scans one level deep): ${sp}`);
          }
        } catch {
          errors.push(`claude-drift: plugin.json skills path not statable: ${sp}`);
        }
      }
      // AG-0256 coverage guard: every scope bucket that HAS skills on disk must
      // be listed in plugin.json skills. A dropped bucket passes the per-entry
      // loop above (it just isn't iterated) yet silently registers zero skills
      // for that scope — the exact failure AG-0256 exists to prevent.
      const listedBuckets = new Set(
        (Array.isArray(pj.skills) ? pj.skills : []).map((p) =>
          p.replace(/^\.\//, "").replace(/\/$/, ""),
        ),
      );
      const genSkillsRoot = join(claudeRoot, "skills");
      if (existsSync(genSkillsRoot)) {
        for (const scope of readdirSync(genSkillsRoot)) {
          const scopeDir = join(genSkillsRoot, scope);
          // try/catch mirrors the D3 per-entry loop — a dangling symlink throws.
          let isDir = false;
          try {
            isDir = statSync(scopeDir).isDirectory();
          } catch {
            continue;
          }
          if (!isDir) continue;
          const hasSkill = readdirSync(scopeDir).some((n) =>
            existsSync(join(scopeDir, n, "SKILL.md")),
          );
          if (hasSkill && !listedBuckets.has(`adapters/claude/skills/${scope}`)) {
            errors.push(
              `claude-drift: scope bucket adapters/claude/skills/${scope}/ has skills but is not listed in plugin.json skills — those skills will not register. Run node scripts/project.mjs.`,
            );
          }
        }
      }
      for (const ap of Array.isArray(pj.agents) ? pj.agents : []) {
        const full = resolvePluginPath(ap);
        if (!existsSync(full)) {
          errors.push(`claude-drift: plugin.json agents path does not resolve: ${ap}`);
        }
      }
      // AG-0257: every plugin.json commands path resolves.
      for (const cp of Array.isArray(pj.commands) ? pj.commands : []) {
        const full = resolvePluginPath(cp);
        if (!existsSync(full)) {
          errors.push(`claude-drift: plugin.json commands path does not resolve: ${cp}`);
        }
      }
      // AG-0257 parity: every generated command must be listed in plugin.json
      // commands, else it lists-but-doesn't-invoke (the bug this projection fixes).
      const listedCommands = new Set(
        (Array.isArray(pj.commands) ? pj.commands : []).map((p) => p.replace(/^\.\//, "")),
      );
      const genCmdRoot = join(claudeRoot, "commands");
      if (existsSync(genCmdRoot)) {
        for (const f of readdirSync(genCmdRoot)) {
          if (!f.endsWith(".md") || f === "AGENTS.md" || f === "CLAUDE.md") continue;
          if (!listedCommands.has(`adapters/claude/commands/${f}`)) {
            errors.push(
              `claude-drift: generated command adapters/claude/commands/${f} is not listed in plugin.json commands — it will not register. Run node scripts/project.mjs.`,
            );
          }
        }
      }
    }
  }

  // D4 + D5. Walk adapters/claude/: zero ${TEMPLATE:} tokens; generated frontmatter
  // parses and carries ONLY allowed keys (forbidden keys → error).
  const ALLOWED_SKILL_KEYS = new Set([
    "name", "description", "model", "paths", "agent", "disallowedTools",
    "argument-hint",
  ]);
  const ALLOWED_AGENT_KEYS = new Set([
    "name", "description", "model", "effort", "maxTurns", "tools",
    "disallowedTools", "skills", "memory", "background", "isolation",
  ]);
  // AG-0257: generated Claude commands carry only Claude-native command keys.
  const ALLOWED_COMMAND_KEYS = new Set(["description", "argument-hint", "allowed-tools"]);
  // The token check targets the GENERATED tree (skills/ + agents/ + commands/), not
  // hand-authored projection notes (adapters/claude/projection.md documents the
  // directive in prose).
  const GENERATED_SUBTREES = [
    "adapters/claude/skills/", "adapters/claude/agents/", "adapters/claude/commands/",
  ];
  if (existsSync(claudeRoot)) {
    for (const file of walk(claudeRoot)) {
      const rel = relative(REPO, file);
      const base = file.replace(/^.*\//, "");
      const inGenerated = GENERATED_SUBTREES.some((p) => rel.startsWith(p));
      const text = ctx.read(file);

      // Zero unresolved template tokens anywhere in the generated skills/agents tree.
      if (inGenerated && text.includes("${TEMPLATE:")) {
        errors.push(`claude-drift: unresolved \${TEMPLATE:} token in generated file: ${rel}`);
      }

      // Frontmatter key allowlist applies to generated SKILL.md, agents/*.md, commands/*.md.
      const isGenSkill = /^adapters\/claude\/skills\/(?:core|languages|workflows)\/[^/]+\/SKILL\.md$/.test(rel);
      const isGenAgent = /^adapters\/claude\/agents\/[^/]+\.md$/.test(rel) && base !== "AGENTS.md" && base !== "CLAUDE.md";
      const isGenCommand = /^adapters\/claude\/commands\/[^/]+\.md$/.test(rel) && base !== "AGENTS.md" && base !== "CLAUDE.md";
      if (!isGenSkill && !isGenAgent && !isGenCommand) continue;

      const kind = isGenSkill ? "skill" : isGenAgent ? "agent" : "command";
      const { fm } = fmSplit(text);
      if (fm === null) {
        errors.push(`claude-drift: generated ${kind} has no parseable frontmatter: ${rel}`);
        continue;
      }
      const allowed = isGenSkill ? ALLOWED_SKILL_KEYS : isGenAgent ? ALLOWED_AGENT_KEYS : ALLOWED_COMMAND_KEYS;
      for (const k of fmTopKeys(fm)) {
        if (!allowed.has(k)) {
          errors.push(`claude-drift: generated ${kind} ${rel} has forbidden frontmatter key '${k}'`);
        }
      }
    }
  }

  return { errors, warnings };
}
