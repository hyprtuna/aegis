// plugin-manifests.mjs — section 9: Codex plugin manifest + Claude marketplace
// manifest parse + version sync with package.json.
//
// AG-0233 Phase B: Codex plugin manifest moved from repo-root .codex-plugin/plugin.json
// to the plugin-root .codex/plugins/aegis/.codex-plugin/plugin.json. The validator
// checks the new path. Also validates the two per-host marketplaces (AG-0255,
// v0.3.4 — one per host, no leak): .agents/plugins/marketplace.json is Codex's
// (OBJECT source form) and .claude-plugin/marketplace.json is Claude's (STRING
// source form). The source-shape rule is inverted between them: Claude rejects
// the object form; Codex rejects the string form.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const id = "PLUGIN_MANIFESTS";

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];

  // AG-0233 Phase B: plugin manifest now lives inside the plugin root.
  // Old path (.codex-plugin/plugin.json at repo root) was deleted during migration.
  const codexPluginJson = join(REPO, ".codex/plugins/aegis/.codex-plugin/plugin.json");
  const claudePluginJson = join(REPO, ".claude-plugin/plugin.json");
  const claudeMarketplaceJson = join(REPO, ".claude-plugin/marketplace.json");
  const agentsMarketplaceJson = join(REPO, ".agents/plugins/marketplace.json");
  const pkgPath = join(REPO, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkgMeta = JSON.parse(ctx.read(pkgPath));
      if (existsSync(codexPluginJson)) {
        const m = JSON.parse(ctx.read(codexPluginJson));
        if (m.version !== pkgMeta.version) {
          errors.push(
            `.codex/plugins/aegis/.codex-plugin/plugin.json version (${m.version}) does not match package.json (${pkgMeta.version})`,
          );
        }
      } else {
        warnings.push(
          `.codex/plugins/aegis/.codex-plugin/plugin.json not found — run node scripts/project.mjs to generate`,
        );
      }
      if (existsSync(claudePluginJson)) {
        const m = JSON.parse(ctx.read(claudePluginJson));
        if (m.version !== pkgMeta.version) {
          errors.push(
            `.claude-plugin/plugin.json version (${m.version}) does not match package.json (${pkgMeta.version})`,
          );
        }
      }
      if (existsSync(claudeMarketplaceJson)) {
        const m = JSON.parse(ctx.read(claudeMarketplaceJson));
        const entryVersion = m?.plugins?.[0]?.version;
        if (entryVersion && entryVersion !== pkgMeta.version) {
          errors.push(
            `.claude-plugin/marketplace.json plugins[0].version (${entryVersion}) does not match package.json (${pkgMeta.version})`,
          );
        }
        // Claude marketplace: source MUST be a relative path STRING (AG-0255).
        // Claude rejects the object {source, path} form (`plugins.0.source:
        // Invalid input`); it must not escape the marketplace root with "../".
        // A missing source is a bad hand-edit — the projector always writes one.
        const entrySource = m?.plugins?.[0]?.source;
        if (entrySource === undefined || entrySource === null) {
          errors.push(
            `.claude-plugin/marketplace.json plugins[0].source is missing — Claude requires a relative path string (e.g. "./"). Run node scripts/project.mjs to fix.`,
          );
        } else if (typeof entrySource !== "string") {
          errors.push(
            `.claude-plugin/marketplace.json plugins[0].source is not a string — Claude requires a relative path string (e.g. "./"). Run node scripts/project.mjs to fix.`,
          );
        } else if (entrySource.includes("..")) {
          errors.push(
            `.claude-plugin/marketplace.json plugins[0].source ("${entrySource}") escapes the marketplace root — Claude rejects "../". Run node scripts/project.mjs to fix.`,
          );
        }
      } else {
        warnings.push(
          `.claude-plugin/marketplace.json not found — run node scripts/project.mjs to generate`,
        );
      }
      // Codex marketplace (AG-0233 D-05): .agents/plugins/marketplace.json
      if (existsSync(agentsMarketplaceJson)) {
        const m = JSON.parse(ctx.read(agentsMarketplaceJson));
        const entryVersion = m?.plugins?.[0]?.version;
        if (entryVersion && entryVersion !== pkgMeta.version) {
          errors.push(
            `.agents/plugins/marketplace.json plugins[0].version (${entryVersion}) does not match package.json (${pkgMeta.version})`,
          );
        }
        // Codex requires the OBJECT {source, path} form with both keys as strings
        // (AG-0255). A string, a missing source, or a malformed object all fail
        // `codex plugin add` at install time.
        const entrySource = m?.plugins?.[0]?.source;
        if (entrySource === undefined || entrySource === null) {
          errors.push(
            `.agents/plugins/marketplace.json plugins[0].source is missing — Codex requires an object {source, path}.`,
          );
        } else if (
          typeof entrySource !== "object" ||
          typeof entrySource.source !== "string" ||
          typeof entrySource.path !== "string"
        ) {
          errors.push(
            `.agents/plugins/marketplace.json plugins[0].source must be an object with string {source, path} — Codex rejects other shapes.`,
          );
        }
      } else {
        warnings.push(
          `.agents/plugins/marketplace.json not found — run node scripts/project.mjs to generate`,
        );
      }
    } catch (e) {
      errors.push(`plugin manifest or package.json invalid JSON: ${e.message}`);
    }
  }

  return { errors, warnings };
}
