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
import { generateClaudeHooksBlock, hookTreeKeepSet } from "../lib/hook-projection.mjs";

export const id = "HOOK_INTENT";

const INTENT_ENUM = new Set([
  "session-start", "pre-compact", "post-compact", "instructions-loaded",
  "file-changed", "cwd-changed",
  "prompt-type", "agent-type",
]);
const CLAUDE_EVENTS = new Set([
  "SessionStart", "PreToolUse", "UserPromptSubmit", "PreCompact", "PostCompact",
  "InstructionsLoaded", "FileChanged", "CwdChanged",
]);
// OpenCode hook keys. These are LITERAL flat dotted property names on the Hooks
// interface — verified against the installed @opencode-ai/plugin type contract
// (dist/index.d.ts, OpenCode 1.18.3). A nested object binding declares a different
// property and is silently never invoked, so the canonical value is the exact key
// string the projector emits.
const OPENCODE_EVENTS = new Set([
  "experimental.chat.messages.transform",
  "experimental.session.compacting",
]);
const OPENCODE_COMPACTING = "experimental.session.compacting";
const DISPATCH_ENUM = new Set(["command", "prompt", "agent"]);
// `codex` stays in the enum so the value is RECOGNISED (and rejected with a
// specific message below) rather than falling through the generic
// unknown-platform error. It is not a supported hook platform — see
// REJECTED_HOOK_PLATFORMS.
const PLATFORM_ENUM = new Set(["claude", "opencode", "codex", "cursor", "zed"]);
// Platforms that are valid surface targets elsewhere in Aegis but cannot carry
// a hook. A hook intent naming one is a hard error, never a silent no-op: the
// projector would emit nothing and report nothing.
const REJECTED_HOOK_PLATFORMS = new Map([
  [
    "codex",
    "Codex's plugin_hooks feature is removed upstream, so a plugin-shipped hook cannot fire " +
      "on this host. Drop \"codex\" from platforms; see adapters/codex/projection.md.",
  ],
]);
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
        if (!PLATFORM_ENUM.has(p)) {
          errors.push(`${where}: unknown platform "${p}"`);
        } else if (REJECTED_HOOK_PLATFORMS.has(p)) {
          errors.push(
            `${where}: "${p}" is not a supported hook platform — ${REJECTED_HOOK_PLATFORMS.get(p)}`,
          );
        }
      }
    }
    if (intent.enabled !== undefined) {
      errors.push(
        `${where}: "enabled" is not a supported field — a hook either ships (delete the ` +
          `field) or is deleted outright (remove the hook); it cannot be parked disabled`,
      );
    }

    const platforms = Array.isArray(intent.platforms) ? intent.platforms : [];

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
          // Flat only: no `/` after the directory. The projector's orphan prune
          // walks this directory one level deep and refuses to descend, so a
          // nested path would name a script the prune cannot account for.
          if (typeof xc.command !== "string" || !/^\.claude-plugin\/hooks\/[^/]+$/.test(xc.command || "")) {
            errors.push(
              `${where}: command dispatch requires command matching ` +
                "^\\.claude-plugin/hooks/[^/]+$ — the hooks tree is flat, no subdirectories",
            );
          } else if (!existsSync(join(REPO, xc.command))) {
            errors.push(`${where}: x-claude.command file does not exist: ${xc.command}`);
          }
        }
        if (xc.dispatch === "prompt" || xc.dispatch === "agent") {
          if (typeof xc.prompt !== "string" || !xc.prompt) {
            errors.push(`${where}: ${xc.dispatch} dispatch requires a non-empty prompt (D4: no agent-name field)`);
          }
        }
        // Declared helper dependencies: the shared libraries this hook sources.
        // A declaration is what protects a file from the projector's prune, so a
        // malformed or dangling one is a hard error — a phantom entry would keep
        // a name reserved that no file answers to, and a nested path would name
        // something the flat tree cannot hold.
        if (xc.helpers !== undefined) {
          if (!Array.isArray(xc.helpers)) {
            errors.push(`${where}: x-claude.helpers must be an array of helper filenames`);
          } else {
            for (const helper of xc.helpers) {
              if (typeof helper !== "string" || !helper) {
                errors.push(`${where}: x-claude.helpers entries must be non-empty strings`);
                continue;
              }
              if (helper.includes("/")) {
                errors.push(
                  `${where}: x-claude.helpers entry "${helper}" must be a bare filename — ` +
                    ".claude-plugin/hooks/ is flat, no subdirectories",
                );
                continue;
              }
              if (!existsSync(join(REPO, ".claude-plugin", "hooks", helper))) {
                errors.push(
                  `${where}: x-claude.helpers declares "${helper}" but ` +
                    `.claude-plugin/hooks/${helper} does not exist`,
                );
              }
            }
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
        if (xo.event === OPENCODE_COMPACTING && xo.phase !== "pre") {
          errors.push(
            `${where}: x-opencode.event ${OPENCODE_COMPACTING} requires phase "pre" — ` +
              "OpenCode fires this hook before compaction starts and exposes no " +
              "post-compaction context-injection hook, so a post binding would never fire",
          );
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

  // ── OpenCode key uniqueness ──────────────────────────────────────────────────
  // The projector emits one object literal keyed by x-opencode.event. Two intents
  // claiming the same key means one silently overwrites the other at parse time —
  // no error, no warning, one dead hook. Reject it here instead.
  const byOpencodeKey = new Map();
  for (const intent of intents) {
    const key = intent["x-opencode"]?.event;
    if (!key || !Array.isArray(intent.platforms) || !intent.platforms.includes("opencode")) continue;
    if (!byOpencodeKey.has(key)) byOpencodeKey.set(key, []);
    byOpencodeKey.get(key).push(intent.name);
  }
  for (const [key, names] of byOpencodeKey) {
    if (names.length > 1) {
      errors.push(
        `hooks/: intents ${names.join(", ")} all bind x-opencode.event "${key}" — ` +
          "the generated handler object is a JS object literal, so a duplicate key " +
          "silently wins and the others never fire. One intent per OpenCode key.",
      );
    }
  }

  // ── Claude hook-script orphans ───────────────────────────────────────────────
  // Every file under .claude-plugin/hooks/ must be referenced by some intent's
  // x-claude.command. A script left behind by a deleted intent still ships inside
  // the plugin and is reachable by anything that discovers the directory by
  // convention, while nothing in canonical mentions it any more. The projector
  // prunes these; this rule is the tripwire for a projector that was never re-run.
  const claudeHooksDir = join(REPO, ".claude-plugin", "hooks");
  if (existsSync(claudeHooksDir)) {
    // The keep-set — command targets AND declared helpers — comes from the SAME
    // function the projector's prune uses (no mirror), so this rule can never
    // demand a file the projector has already deleted, or bless one it reaps.
    const keep = hookTreeKeepSet(intents);
    for (const entry of readdirSync(claudeHooksDir).sort()) {
      if (keep.has(entry)) continue;
      errors.push(
        `.claude-plugin/hooks/${entry}: orphaned — no hooks/*.json intent references it ` +
          "via x-claude.command, and no intent declares it in x-claude.helpers. A file in " +
          "this tree either ships (an intent binds or declares it) or is deleted outright; " +
          "run `node scripts/project.mjs` to prune it.",
      );
    }
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
