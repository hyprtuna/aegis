// codex.mjs — section 8 + FIX-V5/V6/V7/V8/V9: Codex projection checks.
// Skipped silently if `.codex/` is absent. Push order is preserved exactly:
// section-8 per-skill errors, then FIX-V5, FIX-V6, FIX-V7 (warning), FIX-V8 (warnings),
// FIX-V9 (error) Codex bundle drift gate.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const id = "CODEX";

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];
  const templatePlaceholderHits = [];

  const manifestPath = join(REPO, "manifest/aegis.manifest.json");

  // 8. Codex projection checks (v0.0.3). Skipped silently if `.codex/` is absent.
  const codexSkillsRoot = join(REPO, ".codex/plugins/aegis/skills");
  if (existsSync(codexSkillsRoot)) {
    // FIX-V4: build set of agent-derived skill names. Agents project to
    // `.codex/plugins/aegis/skills/aegis-<agent>/SKILL.md` and must carry the
    // "Invoked via Codex Skill discovery." header note in their body.
    const agentDerivedNames = new Set();
    const agentsDir = join(REPO, "agents");
    if (existsSync(agentsDir)) {
      for (const file of readdirSync(agentsDir)) {
        if (!file.endsWith(".md")) continue;
        if (file === "AGENTS.md" || file === "CLAUDE.md") continue;
        const agentBody = ctx.read(join(agentsDir, file));
        let agentName = null;
        if (agentBody.startsWith("---\n")) {
          const fEnd = agentBody.indexOf("\n---", 4);
          if (fEnd > 0) {
            const fmText = agentBody.slice(4, fEnd);
            const m = fmText.match(/^name:\s*(.+)$/m);
            if (m) agentName = m[1].trim().replace(/^["']|["']$/g, "");
          }
        }
        if (!agentName) agentName = file.replace(/\.md$/, "");
        agentDerivedNames.add("aegis-" + agentName);
      }
    }

    for (const dir of readdirSync(codexSkillsRoot)) {
      const skillFile = join(codexSkillsRoot, dir, "SKILL.md");
      if (!existsSync(skillFile)) {
        errors.push(`missing SKILL.md in codex skill folder: .codex/plugins/aegis/skills/${dir}/`);
        continue;
      }
      const body = ctx.read(skillFile);
      if (!body.startsWith("---\n")) {
        errors.push(`codex skill missing frontmatter: ${dir}`);
        continue;
      }
      const fmEnd = body.indexOf("\n---", 4);
      if (fmEnd < 0) {
        errors.push(`codex skill unclosed frontmatter: ${dir}`);
        continue;
      }
      const fmText = body.slice(4, fmEnd);
      if (!/^name:\s+/m.test(fmText)) errors.push(`codex skill frontmatter missing 'name': ${dir}`);
      if (!/^description:\s*/m.test(fmText)) errors.push(`codex skill frontmatter missing 'description': ${dir}`);

      const bodyOnly = body.slice(fmEnd + 4);

      // FIX-V1: projected SKILL.md body must be non-empty.
      if (bodyOnly.trim().length === 0) {
        errors.push(`codex skill body is empty: ${dir}`);
        continue;
      }

      // FIX-V2: abilities/<topic>.md and references/<topic>.md references in the
      // projected body must resolve to a real file under the skill folder.
      const abilityRefs = bodyOnly.match(/abilities\/[a-zA-Z0-9_-]+\.md/g) || [];
      for (const ref of abilityRefs) {
        const refPath = join(codexSkillsRoot, dir, ref);
        if (!existsSync(refPath)) {
          errors.push(`codex skill ${dir} references missing ${ref}`);
        }
      }
      const refRefs = bodyOnly.match(/references\/[a-zA-Z0-9_-]+\.md/g) || [];
      for (const ref of refRefs) {
        const refPath = join(codexSkillsRoot, dir, ref);
        if (!existsSync(refPath)) {
          errors.push(`codex skill ${dir} references missing ${ref}`);
        }
      }

      // FIX-V3: dispatcher body must not contain stale `commands/<name>.md`
      // references. Post-generator-fix, dispatchers redirect to sibling skills.
      const staleCommandRefs = bodyOnly.match(/commands\/[a-zA-Z0-9_-]+\.md/g);
      if (staleCommandRefs) {
        for (const ref of staleCommandRefs) {
          errors.push(`codex skill ${dir} contains stale canonical reference ${ref}`);
        }
      }

      // FIX-V4: agent-derived skills must carry the marker header.
      if (agentDerivedNames.has(dir)) {
        if (!bodyOnly.includes("> Invoked via Codex Skill discovery.")) {
          errors.push(`codex agent-derived skill ${dir} missing marker header '> Invoked via Codex Skill discovery.'`);
        }
      }

      // FIX-V8: ${TEMPLATE:*} placeholders flagged as warnings.
      if (bodyOnly.includes("${TEMPLATE:")) {
        templatePlaceholderHits.push(`.codex/plugins/aegis/skills/${dir}/SKILL.md`);
      }
    }
  }

  // FIX-V5: .codex/INSTALL.md must contain the rule-load verify phrase.
  const codexInstallMd = join(REPO, ".codex/INSTALL.md");
  if (existsSync(codexInstallMd)) {
    const installBody = ctx.read(codexInstallMd);
    if (!installBody.includes("Quote the Aegis Iron Law about abilities")) {
      errors.push(".codex/INSTALL.md missing rule-load verify phrase 'Quote the Aegis Iron Law about abilities'");
    }
  }

  // FIX-V6: manifest hostStatus self-consistency for Codex.
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(ctx.read(manifestPath));
      const codexStatus = manifest?.hostStatus?.codex || "";
      if (/shipped/i.test(codexStatus)) {
        const codexTree = join(REPO, ".codex/plugins/aegis/skills");
        let hasSkill = false;
        if (existsSync(codexTree)) {
          for (const dir of readdirSync(codexTree)) {
            if (existsSync(join(codexTree, dir, "SKILL.md"))) {
              hasSkill = true;
              break;
            }
          }
        }
        if (!hasSkill) {
          errors.push(`manifest hostStatus.codex claims '${codexStatus}' but .codex/plugins/aegis/skills/ has no SKILL.md files`);
        }
      }
    } catch {
      // JSON parse error already reported elsewhere.
    }
  }

  // FIX-V7: removed — the repo-root .codex-plugin/plugin.json was deleted in
  // v0.2.0. The new manifest at
  // .codex/plugins/aegis/.codex-plugin/plugin.json is generated by project.mjs
  // with a hardcoded homepage (no <owner> placeholder ever emitted), so the
  // placeholder check is permanently obsolete.

  // FIX-V8: emit TEMPLATE placeholder warning.
  if (templatePlaceholderHits.length > 0) {
    warnings.push(`${templatePlaceholderHits.length} projected Codex SKILL.md file(s) contain literal \${TEMPLATE:*} placeholders (v0.0.4 templates-surface concern):`);
    for (const f of templatePlaceholderHits) warnings.push(`  - ${f}`);
  }

  // FIX-V9: Codex bundle drift gate. Assert that the bundled hook scripts in
  // .codex/plugins/aegis/hooks/ byte-equal their canonical sources. A stale
  // copy would silently weaken a Codex-bundled hook. Fires on every
  // validate-structure run.
  const codexHooksDir = join(REPO, ".codex/plugins/aegis/hooks");
  if (existsSync(codexHooksDir)) {
    // Hook script drift check. Each bundled .sh must byte-equal the corresponding
    // .claude-plugin/hooks/<name>.sh (both are version-stamped to the same version
    // post-project, so byte equality holds when in sync).
    const claudeHooksDir = join(REPO, ".claude-plugin/hooks");
    if (existsSync(claudeHooksDir)) {
      let bundledScripts;
      try {
        bundledScripts = readdirSync(codexHooksDir).filter((f) => f.endsWith(".sh"));
      } catch {
        bundledScripts = [];
      }
      for (const script of bundledScripts) {
        const bundledScript = join(codexHooksDir, script);
        const claudeScript = join(claudeHooksDir, script);
        if (!existsSync(claudeScript)) {
          // No matching Claude script — skip (Codex may bundle extras; not an error here).
          continue;
        }
        const bundledScriptBytes = readFileSync(bundledScript);
        const claudeScriptBytes = readFileSync(claudeScript);
        if (!bundledScriptBytes.equals(claudeScriptBytes)) {
          errors.push(
            `Codex bundled hook script drift: .codex/plugins/aegis/hooks/${script} ` +
            `does not match .claude-plugin/hooks/${script} — re-run \`node scripts/project.mjs\``
          );
        }
      }
    }
  }

  return { errors, warnings };
}
