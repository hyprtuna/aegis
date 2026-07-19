// hook-intent.mjs — the HOOK_INTENT contract validator (HARD-FAIL).
//
// Hand-rolled (no ajv), stdlib only, mirrors statusline.mjs. Validates canonical
// hooks/*.json against the contract decisions.md encodes:
//   - schema shape (required fields, enums, host-binding completeness)
//   - event→dispatch support table (D3)
//   - .md pairing (D1): name match, required-when rules
//   - command-file existence under .claude-plugin/hooks/
//   - compaction symmetry (pre-compact ⇔ post-compact ship together)
//   - plugin.json drift (D6): regenerate the expected Claude hooks block in-memory
//     and compare to the committed .claude-plugin/plugin.json hooks block
//   - adapter gap-coverage (D9): every shipped intent has a row in every
//     adapters/<host>/projection.md (warn-only for now — Phase E authors rows).
//
// The drift check calls the SHARED generateClaudeHooksBlock() from
// scripts/lib/hook-projection.mjs — the exact same function the projector uses.
// There is no mirror to drift out of sync: if projection ever changed shape, this
// rule sees the new shape too and the committed plugin.json comparison is the
// tripwire that keeps the contract honest.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateClaudeHooksBlock } from "../lib/hook-projection.mjs";

export const id = "HOOK_INTENT";

const INTENT_ENUM = new Set([
  "session-start", "pre-compact", "post-compact", "instructions-loaded",
  "file-changed", "cwd-changed", "prompt-injection-guard", "pre-tool-use-deny",
  "prompt-type", "agent-type",
]);
const CLAUDE_EVENTS = new Set([
  "SessionStart", "PreToolUse", "UserPromptSubmit", "PreCompact", "PostCompact",
  "InstructionsLoaded", "FileChanged", "CwdChanged",
]);
const OPENCODE_EVENTS = new Set(["session.start", "session.compacting", "chat.messages.transform"]);
// Codex hook events (verified against codex 0.141.0).
const CODEX_EVENTS = new Set([
  "SessionStart", "SubagentStart", "PreToolUse", "PermissionRequest", "PostToolUse",
  "PreCompact", "PostCompact", "UserPromptSubmit", "SubagentStop", "Stop",
]);
const DISPATCH_ENUM = new Set(["command", "prompt", "agent"]);
const PLATFORM_ENUM = new Set(["claude", "opencode", "codex", "cursor", "zed"]);
const VISIBILITY_ENUM = new Set(["internal", "public"]);

// Event → allowed dispatch types (D3, verified against hooks.md).
const EVENT_DISPATCH = {
  SessionStart: new Set(["command"]),
  PreToolUse: new Set(["command", "prompt", "agent"]),
  UserPromptSubmit: new Set(["command", "prompt", "agent"]),
  PreCompact: new Set(["command"]),
  PostCompact: new Set(["command"]),
  InstructionsLoaded: new Set(["command"]),
  FileChanged: new Set(["command"]),
  CwdChanged: new Set(["command"]),
};

const HOSTS = ["claude", "opencode", "codex", "cursor", "zed"];

// Escape regex metacharacters in an intent/name key so it can be embedded in a
// table-row-anchored RegExp (keys are kebab-case but `-` is a metachar inside [..]
// and escaping defensively is cheap + future-proof).
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Load a hook intent's sibling .md frontmatter name, or null if no .md.
function mdName(ctx, hooksDir, name) {
  const mdPath = join(hooksDir, `${name}.md`);
  if (!existsSync(mdPath)) return undefined;
  const { fm } = ctx.fmSplit(ctx.read(mdPath));
  if (!fm) return null;
  const line = fm.split("\n").find((l) => /^name:/.test(l));
  if (!line) return null;
  return line.replace(/^name:\s*/, "").replace(/^['"]|['"]$/g, "").trim();
}

export function run(ctx) {
  const { REPO } = ctx;
  const errors = [];
  const warnings = [];

  const hooksDir = join(REPO, "hooks");
  if (!existsSync(hooksDir)) return { errors, warnings };

  const files = readdirSync(hooksDir).filter((f) => f.endsWith(".json")).sort();
  const intents = [];

  for (const file of files) {
    let intent;
    try {
      intent = JSON.parse(ctx.read(join(hooksDir, file)));
    } catch (e) {
      errors.push(`hooks/${file}: invalid JSON (${e.message})`);
      continue;
    }
    const where = `hooks/${file}`;

    // ── Schema shape ─────────────────────────────────────────────────────────
    if (intent.kind !== "hook") errors.push(`${where}: kind must be "hook"`);
    if (!INTENT_ENUM.has(intent.intent)) errors.push(`${where}: unknown intent "${intent.intent}"`);
    if (typeof intent.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(intent.name || "")) {
      errors.push(`${where}: name must match ^[a-z][a-z0-9-]*$`);
    } else {
      // Filename base, minus the cosmetic ".prompt"/".agent" infix (D10).
      const fileBase = file.replace(/\.json$/, "").replace(/\.(prompt|agent)$/, "");
      if (intent.name !== fileBase) {
        errors.push(`${where}: name "${intent.name}" must match filename base "${fileBase}"`);
      }
    }
    if (typeof intent.description !== "string" || intent.description.length < 1 || intent.description.length > 512) {
      errors.push(`${where}: description must be 1–512 chars`);
    }
    if (!VISIBILITY_ENUM.has(intent.visibility)) errors.push(`${where}: visibility must be internal|public`);
    if (!Array.isArray(intent.platforms) || intent.platforms.length === 0) {
      errors.push(`${where}: platforms must be a non-empty array`);
    } else {
      for (const p of intent.platforms) {
        if (!PLATFORM_ENUM.has(p)) errors.push(`${where}: unknown platform "${p}"`);
      }
    }
    if (intent.enabled !== undefined && typeof intent.enabled !== "boolean") {
      errors.push(`${where}: enabled must be a boolean`);
    }

    const platforms = Array.isArray(intent.platforms) ? intent.platforms : [];

    // ── Conditional intent rules ───────────────────────────────────────────────
    if (intent.intent === "prompt-injection-guard" && intent.enabled !== false) {
      errors.push(`${where}: prompt-injection-guard must ship enabled:false (D7)`);
    }

    // ── x-claude host-binding completeness + event→dispatch table ─────────────
    if (platforms.includes("claude")) {
      const xc = intent["x-claude"];
      if (!xc || typeof xc !== "object") {
        errors.push(`${where}: platforms includes "claude" but x-claude binding is missing`);
      } else {
        if (!CLAUDE_EVENTS.has(xc.event)) errors.push(`${where}: x-claude.event "${xc.event}" not in allowed enum`);
        if (!DISPATCH_ENUM.has(xc.dispatch)) errors.push(`${where}: x-claude.dispatch "${xc.dispatch}" not in command|prompt|agent`);
        // Event→dispatch support table (D3).
        if (CLAUDE_EVENTS.has(xc.event) && DISPATCH_ENUM.has(xc.dispatch)) {
          const allowed = EVENT_DISPATCH[xc.event];
          if (allowed && !allowed.has(xc.dispatch)) {
            errors.push(
              `${where}: event ${xc.event} does not support dispatch "${xc.dispatch}" ` +
                `(allowed: ${[...allowed].join(", ")}) — D3 support table`,
            );
          }
        }
        // dispatch→required-field.
        if (xc.dispatch === "command") {
          if (typeof xc.command !== "string" || !/^\.claude-plugin\/hooks\/.+/.test(xc.command || "")) {
            errors.push(`${where}: command dispatch requires command matching ^\\.claude-plugin/hooks/.+`);
          } else if (!existsSync(join(REPO, xc.command))) {
            errors.push(`${where}: x-claude.command file does not exist: ${xc.command}`);
          }
        }
        if (xc.dispatch === "prompt" || xc.dispatch === "agent") {
          if (typeof xc.prompt !== "string" || !xc.prompt) {
            errors.push(`${where}: ${xc.dispatch} dispatch requires a non-empty prompt (D4: no agent-name field)`);
          }
        }
        // Judgment category ↔ dispatch coupling.
        if (intent.intent === "prompt-type" && xc.dispatch !== "prompt") {
          errors.push(`${where}: intent prompt-type requires x-claude.dispatch "prompt"`);
        }
        if (intent.intent === "agent-type" && xc.dispatch !== "agent") {
          errors.push(`${where}: intent agent-type requires x-claude.dispatch "agent"`);
        }
      }
    }

    // ── x-opencode host-binding completeness ──────────────────────────────────
    if (platforms.includes("opencode")) {
      const xo = intent["x-opencode"];
      if (!xo || typeof xo !== "object") {
        errors.push(`${where}: platforms includes "opencode" but x-opencode binding is missing`);
      } else {
        if (!OPENCODE_EVENTS.has(xo.event)) errors.push(`${where}: x-opencode.event "${xo.event}" not in allowed enum`);
        if (typeof xo.handler !== "string" || !xo.handler) errors.push(`${where}: x-opencode.handler must be a non-empty string`);
        if (xo.event === "session.compacting" && xo.phase !== "pre" && xo.phase !== "post") {
          errors.push(`${where}: x-opencode.event session.compacting requires phase pre|post`);
        }
      }
    }

    // ── x-codex host-binding completeness + event validation ──────────────────
    if (platforms.includes("codex")) {
      const xcodex = intent["x-codex"];
      if (!xcodex || typeof xcodex !== "object") {
        errors.push(`${where}: platforms includes "codex" but x-codex binding is missing`);
      } else {
        if (!CODEX_EVENTS.has(xcodex.event)) {
          errors.push(`${where}: x-codex.event "${xcodex.event}" not in allowed Codex event enum`);
        }
        if (!DISPATCH_ENUM.has(xcodex.dispatch)) {
          errors.push(`${where}: x-codex.dispatch "${xcodex.dispatch}" not in command|prompt|agent`);
        }
        if (xcodex.dispatch === "command") {
          if (typeof xcodex.command !== "string" || !xcodex.command) {
            errors.push(`${where}: x-codex.dispatch "command" requires a non-empty "command"`);
          }
        }
      }
    }

    // ── .md pairing (D1) ──────────────────────────────────────────────────────
    const dispatch = intent["x-claude"]?.dispatch;
    const mdRequired =
      dispatch === "prompt" || dispatch === "agent" ||
      intent.intent === "pre-compact" || intent.intent === "post-compact";
    const sibling = mdName(ctx, hooksDir, intent.name);
    if (mdRequired && sibling === undefined) {
      errors.push(`${where}: a sibling hooks/${intent.name}.md is required for ${intent.intent}/${dispatch} hooks (D1)`);
    }
    if (sibling !== undefined && sibling !== null && sibling !== intent.name) {
      errors.push(`${where}: sibling .md name "${sibling}" must equal json name "${intent.name}" (D1)`);
    }

    intents.push(intent);
  }

  // ── Compaction symmetry (pre ⇔ post must ship together) ──────────────────────
  const intentKinds = new Set(intents.map((i) => i.intent));
  if (intentKinds.has("pre-compact") !== intentKinds.has("post-compact")) {
    errors.push(`hooks/: compaction hooks must ship as a pre-compact ⇔ post-compact pair (D9)`);
  }

  // ── plugin.json drift (D6) ───────────────────────────────────────────────────
  const pluginPath = join(REPO, ".claude-plugin", "plugin.json");
  if (existsSync(pluginPath)) {
    let committed;
    try {
      committed = JSON.parse(ctx.read(pluginPath));
    } catch (e) {
      errors.push(`.claude-plugin/plugin.json: invalid JSON (${e.message})`);
      committed = null;
    }
    if (committed) {
      const expected = generateClaudeHooksBlock(intents);
      const committedHooks = committed.hooks ?? {};
      const a = JSON.stringify(expected);
      const b = JSON.stringify(committedHooks);
      if (a !== b) {
        errors.push(
          ".claude-plugin/plugin.json hooks block is out of sync with canonical hooks/*.json " +
            "(D6 drift) — run `node scripts/project.mjs` to regenerate.",
        );
      }
    }
  }

  // ── Adapter gap-coverage (D9) — HARD-FAIL (graduated in Phase E). ─────────────
  // Every shipped intent must have a hook-matrix row in every adapters/<host>/
  // projection.md (keyed by name for judgment hooks, by intent otherwise). The
  // Phase E matrices author these rows; this gate keeps "honest gaps" enforced —
  // no shipped intent may be silently dropped from a host's projection doc.
  for (const intent of intents) {
    const key = (intent.intent === "prompt-type" || intent.intent === "agent-type")
      ? intent.name : intent.intent;
    // Anchor on a markdown table-row cell rather than a loose substring: the key
    // must appear as its own cell — `| <key> |` or `| `<key>` | — so an incidental
    // mention in prose can't satisfy the gate. Backtick-fencing of the key is
    // optional; surrounding whitespace is tolerated. Regex metachars in the key
    // (e.g. `-`) are escaped.
    const esc = escapeRegex(key);
    const rowRe = new RegExp(`\\|\\s*\`?${esc}\`?\\s*\\|`);
    for (const host of HOSTS) {
      const projPath = join(REPO, "adapters", host, "projection.md");
      if (!existsSync(projPath)) continue; // adapter doc absent → skip (its own rule covers that).
      const text = ctx.read(projPath);
      if (!rowRe.test(text)) {
        errors.push(
          `adapters/${host}/projection.md: no hook-matrix row for "${key}" ` +
            `(intent ${intent.name}) — every shipped hook intent must have a per-host table row ` +
            "of the form | `<key>` | … | (D9).",
        );
      }
    }
  }

  return { errors, warnings };
}
