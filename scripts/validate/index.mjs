// index.mjs — validator orchestrator.
//
// Builds the shared context ONCE, runs each rule module in the fixed order the
// monolith ran its sections (so output ordering is preserved), concatenates
// errors+warnings, enforces the 30s ceiling, prints warnings then errors exactly
// as the monolith did, and process.exit(1) on errors.
//
// New rules are added by: (1) create scripts/validate/<rule>.mjs exporting
// `id` + `run(ctx)`, (2) add ONE import + ONE entry in RULES below.

import { buildContext } from "./_context.mjs";

import * as rootFiles from "./root-files.mjs";
import * as sparseGuidance from "./sparse-guidance.mjs";
import * as frontmatter from "./frontmatter.mjs";
import * as manifest from "./manifest.mjs";
import * as statusline from "./statusline.mjs";
import * as templates from "./templates.mjs";
import * as templateIndex from "./template-index.mjs";
import * as codex from "./codex.mjs";
import * as pluginManifests from "./plugin-manifests.mjs";
import * as hookIntent from "./hook-intent.mjs";
import * as codexAgents from "./codex-agents.mjs";
import * as permissions from "./permissions.mjs";
import * as capabilities from "./capabilities.mjs";
import * as claudeDrift from "./claude-drift.mjs";
import * as capabilityDocsSync from "./capability-docs-sync.mjs";

// v0.0.6 — warn-only hardening rules.
import * as toolNameLeak from "./tool-name-leak.mjs";
import * as agentNameCollision from "./agent-name-collision.mjs";
import * as skillBodyLong from "./skill-body-long.mjs";
import * as bucketReadme from "./bucket-readme.mjs";
import * as lockfile from "./lockfile.mjs";

// v0.0.9 — named-artifact → template rule (warn-only).
import * as namedArtifactTemplate from "./named-artifact-template.mjs";

// v0.0.12 — trigger-phrase lint (warn-only), doc-drift
// (count = error, dead-link = error), stance cross-check (warn-only).
import * as triggerPhrase from "./trigger-phrase.mjs";
import * as docDrift from "./doc-drift.mjs";
import * as stance from "./stance.mjs";
import * as advertisedVisibility from "./advertised-visibility.mjs";

// v0.0.13 — acyclic-composition validator (warn-only).
import * as composition from "./composition.mjs";

// v0.0.14 — canonical SKILL.md body size cap (warn-only). Owns the
// >100-line finding; skill-body-long.mjs now emits SKILL_DESC_LONG only.
import * as skillSize from "./skill-size.mjs";

// v0.1.0 — plugin-subagent silent-drop trap (warn-only): flags
// x-claude.{hooks,mcpServers,permissionMode} on agents (Claude drops them for
// plugin-loaded subagents).
import * as agentPluginDrop from "./agent-plugin-drop.mjs";

// v0.1.2 — description-shape lint (warn-only): flags a mechanism
// marker (arrow or conjugated process verb) in a `description:` field.
import * as descriptionShape from "./description-shape.mjs";

// v0.1.4 — shipped-ref guard (warn-only): flags AG-NNNN ticket references
// (all files) and pre-launch v0.0/0.2/0.3.x version stamps (.md only) that
// should not reach the public tree post-launch.
import * as shippedRef from "./shipped-ref.mjs";

// Ordered to match the original monolith's section sequence (1 → 12).
const RULES = [
  rootFiles,           // 1
  sparseGuidance,      // 2, 3, 4
  frontmatter,         // 5
  manifest,            // 6, 7
  statusline,          // 7b
  templates,           // 7c
  templateIndex,       // 7d — template-index integrity + slot↔body cross-check
  codex,               // 8 + FIX-V5/V6/V7/V8
  pluginManifests,     // 9
  hookIntent,          // 9b — HARD-FAIL contract validator
  codexAgents,         // 10
  permissions,         // v0.0.5 pass A
  capabilities,        // v0.0.5 passes B, C
  claudeDrift,         // v0.0.5 pass D
  capabilityDocsSync,  // 12
  // v0.0.6 warn-only hardening rules:
  toolNameLeak,        // A3
  agentNameCollision,  // A4
  skillBodyLong,       // A5 (desc-length only; body-size moved to skillSize)
  bucketReadme,        // A6
  lockfile,            // C1
  // v0.0.9 warn-only:
  namedArtifactTemplate, // NAMED_ARTIFACT_TEMPLATE
  // v0.0.12:
  triggerPhrase,         // TRIGGER_PHRASE (warn-only; hard-fail in v0.0.13)
  docDrift,              // DOC_DRIFT (count = error, dead-link = error)
  stance,                // STANCE (warn-only)
  advertisedVisibility,  // ADVERTISED_VISIBILITY — an advertised entry point must stay in the / menu
  // v0.0.13 warn-only:
  composition,           // COMPOSITION (acyclic + existence + handoff; warn-only, hard-fail next release)
  // v0.0.14 warn-only:
  skillSize,             // SKILL_SIZE (canonical SKILL.md >100-line body cap; sole owner of the size finding)
  // v0.1.0 warn-only:
  agentPluginDrop,       // AGENT_PLUGIN_DROP (x-claude.{hooks,mcpServers,permissionMode} silently dropped for plugin subagents)
  // v0.1.2 warn-only:
  descriptionShape,      // DESCRIPTION_SHAPE (arrow or conjugated process verb in a description; graduates to hard-fail in v0.1.3)
  // v0.1.4 warn-only:
  shippedRef,            // SHIPPED_REF (AG-NNNN ticket refs + pre-launch v0.0/0.2/0.3.x .md version stamps; graduates to hard-fail in v0.2.0)
];

export function main() {
  const REPO = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
  const start = Date.now();
  const ctx = buildContext(REPO);

  const errors = [];
  const warnings = [];
  for (const rule of RULES) {
    const { errors: ruleErrors = [], warnings: ruleWarnings = [] } = rule.run(ctx);
    for (const e of ruleErrors) errors.push(e);
    for (const w of ruleWarnings) warnings.push(w);
  }

  const elapsedMs = Date.now() - start;

  if (elapsedMs > 30000) {
    errors.push(`validation exceeded 30s ceiling: ${elapsedMs}ms`);
  }

  if (warnings.length > 0) {
    console.warn("Aegis structure check warnings:");
    for (const w of warnings) console.warn(`  - ${w}`);
  }

  if (errors.length > 0) {
    console.error("Aegis structure check FAILED:");
    for (const e of errors) console.error(`  - ${e}`);
    console.error(`(${elapsedMs}ms)`);
    process.exit(1);
  }

  console.log(`Aegis structure check passed (${elapsedMs}ms)`);
}

main();
