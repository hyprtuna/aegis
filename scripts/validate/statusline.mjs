// statusline.mjs — section 7b: validate statuslines/<preset>/statusline.json and
// statuslines/_shared/themes/*.json against the descriptor/theme contracts.
// Hand-rolled (no ajv) — stays dependency-free and fast.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const id = "STATUSLINE";

const STATUSLINE_SEGMENT_IDS = new Set([
  "model", "project", "added-dirs", "git", "worktree", "pr", "effort", "context",
  "context-detailed", "usage", "prompt-cache", "cost", "tools", "agents",
  "todos", "task-banner", "claude-md", "session-time",
  "custom-line",
]);

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];

  const statuslinesRoot = join(REPO, "statuslines");
  if (existsSync(statuslinesRoot)) {
    const themesDir = join(statuslinesRoot, "_shared", "themes");
    const themeNames = new Set();

    // Themes first (presets reference them).
    if (existsSync(themesDir)) {
      for (const f of readdirSync(themesDir)) {
        if (!f.endsWith(".json")) continue;
        const themeName = f.replace(/\.json$/, "");
        let theme;
        try {
          theme = JSON.parse(ctx.read(join(themesDir, f)));
        } catch (e) {
          errors.push(`statusline theme invalid JSON: _shared/themes/${f} (${e.message})`);
          continue;
        }
        if (theme.name !== themeName) {
          errors.push(`statusline theme name '${theme.name}' does not match filename: _shared/themes/${f}`);
        }
        if (!theme.colors || typeof theme.colors !== "object" || Array.isArray(theme.colors) || Object.keys(theme.colors).length === 0) {
          errors.push(`statusline theme missing non-empty 'colors' map: _shared/themes/${f}`);
        }
        themeNames.add(themeName);
      }
    }

    // Preset descriptors.
    for (const entry of readdirSync(statuslinesRoot)) {
      if (entry.startsWith("_") || entry === "AGENTS.md" || entry === "CLAUDE.md") continue;
      const presetDir = join(statuslinesRoot, entry);
      let st;
      try { st = statSync(presetDir); } catch { continue; }
      if (!st.isDirectory()) continue;
      const descPath = join(presetDir, "statusline.json");
      if (!existsSync(descPath)) {
        errors.push(`statusline preset folder missing statusline.json: statuslines/${entry}/`);
        continue;
      }
      let d;
      try {
        d = JSON.parse(ctx.read(descPath));
      } catch (e) {
        errors.push(`statusline descriptor invalid JSON: statuslines/${entry}/statusline.json (${e.message})`);
        continue;
      }
      if (d.kind !== "statusline") errors.push(`statuslines/${entry}: kind must be 'statusline'`);
      if (d.name !== entry) errors.push(`statuslines/${entry}: name '${d.name}' must match folder name`);
      for (const k of ["description", "visibility", "theme"]) {
        if (!d[k]) errors.push(`statuslines/${entry}: missing '${k}'`);
      }
      if (!Array.isArray(d.platforms) || d.platforms.length === 0) {
        errors.push(`statuslines/${entry}: 'platforms' must be a non-empty array`);
      }
      if (d.theme && themeNames.size > 0 && !themeNames.has(d.theme)) {
        errors.push(`statuslines/${entry}: references unknown theme '${d.theme}' (no _shared/themes/${d.theme}.json)`);
      }
      if (!Array.isArray(d.segments) || d.segments.length === 0) {
        errors.push(`statuslines/${entry}: 'segments' must be a non-empty array of line arrays`);
      } else {
        for (const line of d.segments) {
          if (!Array.isArray(line) || line.length === 0) {
            errors.push(`statuslines/${entry}: each 'segments' entry must be a non-empty array of segment IDs`);
            continue;
          }
          for (const seg of line) {
            if (!STATUSLINE_SEGMENT_IDS.has(seg)) {
              errors.push(`statuslines/${entry}: unknown segment ID '${seg}'`);
            }
          }
        }
      }
      if (d.refreshIntervalSeconds !== undefined &&
          (!Number.isInteger(d.refreshIntervalSeconds) || d.refreshIntervalSeconds < 0)) {
        errors.push(`statuslines/${entry}: 'refreshIntervalSeconds' must be a non-negative integer`);
      }

      // ── v0.0.14 composability fields (ALL optional — existing configs omit
      // them and pass unchanged). Hand-rolled, no ajv.
      const declaredSegs = new Set();
      if (Array.isArray(d.segments)) {
        for (const line of d.segments) if (Array.isArray(line)) for (const s of line) declaredSegs.add(s);
      }

      // order — array of known segment IDs, unique, and present in this preset.
      if (d.order !== undefined) {
        if (!Array.isArray(d.order)) {
          errors.push(`statuslines/${entry}: 'order' must be an array of segment IDs`);
        } else {
          const seen = new Set();
          for (const id of d.order) {
            if (typeof id !== "string" || !STATUSLINE_SEGMENT_IDS.has(id)) {
              errors.push(`statuslines/${entry}: 'order' has unknown segment ID '${id}'`);
            } else if (seen.has(id)) {
              errors.push(`statuslines/${entry}: 'order' lists segment '${id}' more than once`);
            } else {
              seen.add(id);
              if (!declaredSegs.has(id)) {
                errors.push(`statuslines/${entry}: 'order' references segment '${id}' not present in 'segments'`);
              }
            }
          }
        }
      }

      // mergeGroups — arrays of >=2 known IDs; a segment in at most one group.
      if (d.mergeGroups !== undefined) {
        if (!Array.isArray(d.mergeGroups)) {
          errors.push(`statuslines/${entry}: 'mergeGroups' must be an array of segment-ID arrays`);
        } else {
          const claimed = new Set();
          for (const grp of d.mergeGroups) {
            if (!Array.isArray(grp) || grp.length < 2) {
              errors.push(`statuslines/${entry}: each 'mergeGroups' entry must list >=2 segment IDs`);
              continue;
            }
            for (const id of grp) {
              if (typeof id !== "string" || !STATUSLINE_SEGMENT_IDS.has(id)) {
                errors.push(`statuslines/${entry}: 'mergeGroups' has unknown segment ID '${id}'`);
              } else if (claimed.has(id)) {
                errors.push(`statuslines/${entry}: segment '${id}' appears in more than one mergeGroup`);
              } else {
                claimed.add(id);
              }
            }
          }
        }
      }
      if (d.mergeSeparator !== undefined && typeof d.mergeSeparator !== "string") {
        errors.push(`statuslines/${entry}: 'mergeSeparator' must be a string`);
      }

      // separator — the inter-segment separator GLYPH (optional; default '·').
      // maxLength: 8 mirrors manifest/schemas/statusline.schema.json's
      // 'separator' property — keep the two in sync.
      if (d.separator !== undefined) {
        if (typeof d.separator !== "string") {
          errors.push(`statuslines/${entry}: 'separator' must be a string`);
        } else if (d.separator.length > 8) {
          errors.push(`statuslines/${entry}: 'separator' must be at most 8 characters (got ${d.separator.length})`);
        }
      }

      // thresholds — { metric: [ { at:number, color:string, label?:string }, … ] }
      if (d.thresholds !== undefined) {
        if (typeof d.thresholds !== "object" || d.thresholds === null || Array.isArray(d.thresholds)) {
          errors.push(`statuslines/${entry}: 'thresholds' must be an object keyed by metric`);
        } else {
          for (const [metric, breaks] of Object.entries(d.thresholds)) {
            if (!Array.isArray(breaks) || breaks.length === 0) {
              errors.push(`statuslines/${entry}: thresholds.${metric} must be a non-empty array of breakpoints`);
              continue;
            }
            for (const b of breaks) {
              if (!b || typeof b !== "object" || typeof b.at !== "number") {
                errors.push(`statuslines/${entry}: thresholds.${metric} breakpoint needs numeric 'at'`);
              }
              if (!b || typeof b.color !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(b.color)) {
                errors.push(`statuslines/${entry}: thresholds.${metric} breakpoint needs a theme color KEY (string)`);
              }
              if (b && b.label !== undefined && typeof b.label !== "string") {
                errors.push(`statuslines/${entry}: thresholds.${metric} breakpoint 'label' must be a string`);
              }
            }

            // Runtime footgun (warn-only, AG-0261): ctx.threshold() resolves the
            // FIRST breakpoint with `at <= value`, which only picks the intended
            // (highest-severity-first) breakpoint when a metric's 'at' values are
            // authored strictly descending. Flag authoring order that would silently
            // pick the wrong breakpoint at runtime.
            const ats = breaks.filter((b) => b && typeof b.at === "number").map((b) => b.at);
            for (let i = 1; i < ats.length; i += 1) {
              if (ats[i] >= ats[i - 1]) {
                warnings.push(
                  `statuslines/${entry}: thresholds.${metric} 'at' values are not strictly descending (${ats.join(", ")}) — ctx.threshold() picks the first match, so out-of-order breakpoints resolve to the wrong color/label`,
                );
                break;
              }
            }
          }
        }
      }

      // i18n — { locale?:string, labels: { key: string } } with non-empty labels.
      if (d.i18n !== undefined) {
        if (typeof d.i18n !== "object" || d.i18n === null || Array.isArray(d.i18n)) {
          errors.push(`statuslines/${entry}: 'i18n' must be an object`);
        } else {
          if (!d.i18n.labels || typeof d.i18n.labels !== "object" || Array.isArray(d.i18n.labels) ||
              Object.keys(d.i18n.labels).length === 0) {
            errors.push(`statuslines/${entry}: 'i18n.labels' must be a non-empty object of key→string`);
          } else {
            for (const [k, v] of Object.entries(d.i18n.labels)) {
              if (typeof v !== "string") errors.push(`statuslines/${entry}: i18n.labels.${k} must be a string`);
            }
          }
          if (d.i18n.locale !== undefined && !/^[a-z]{2}(-[A-Z]{2})?$/.test(String(d.i18n.locale))) {
            errors.push(`statuslines/${entry}: i18n.locale '${d.i18n.locale}' is not a BCP-47-ish tag (e.g. 'en', 'pt-BR')`);
          }
        }
      }
    }
  }

  return { errors, warnings };
}
