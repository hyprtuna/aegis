#!/usr/bin/env node
// hook-intent.test.mjs — unit tests for the HOOK_INTENT validator (AG-0010 D9).
//
// Dependency-free, TAP-ish (matches scripts/test-projection.mjs style). Builds a
// throwaway hooks/ fixture dir under a temp REPO, runs scripts/validate/hook-intent.mjs
// against it, and asserts the expected errors fire (or don't). No real repo state
// is touched. Run: node scripts/tests/hook-intent.test.mjs  (exit 1 on any failure)
// Node 20+ stdlib only.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { run as runHookIntent } from "../validate/hook-intent.mjs";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Minimal ctx shim mirroring the validate/_context.mjs surface the rule uses
// (REPO, read, fmSplit). No tree walk needed — the rule globs hooks/ itself.
function makeCtx(REPO) {
  return {
    REPO,
    read: (p) => readFileSync(p, "utf8"),
    fmSplit(text) {
      if (!text.startsWith("---\n")) return { fm: null, body: text };
      const end = text.indexOf("\n---", 4);
      if (end < 0) return { fm: null, body: text };
      return { fm: text.slice(4, end), body: text.slice(end + 4) };
    },
  };
}

// Build a temp REPO with a hooks/ dir, an empty .claude-plugin/plugin.json (no
// hooks key → drift compares against {}), and optional command-hook stub files.
function scaffold(intentByName, { commandFiles = [], pluginHooks = undefined, mdFiles = {} } = {}) {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-hook-test-"));
  mkdirSync(join(REPO, "hooks"), { recursive: true });
  mkdirSync(join(REPO, ".claude-plugin", "hooks"), { recursive: true });
  for (const [name, intent] of Object.entries(intentByName)) {
    writeFileSync(join(REPO, "hooks", `${name}.json`), JSON.stringify(intent, null, 2));
  }
  for (const [name, body] of Object.entries(mdFiles)) {
    writeFileSync(join(REPO, "hooks", `${name}.md`), body);
  }
  for (const rel of commandFiles) {
    writeFileSync(join(REPO, rel), "#!/usr/bin/env bash\necho hi\n");
  }
  const plugin = pluginHooks === undefined ? {} : { hooks: pluginHooks };
  writeFileSync(join(REPO, ".claude-plugin", "plugin.json"), JSON.stringify(plugin, null, 2));
  return REPO;
}

function validIntent(overrides = {}) {
  return {
    kind: "hook",
    intent: "session-start",
    name: "session-start",
    description: "Bootstrap.",
    visibility: "internal",
    platforms: ["claude"],
    "x-claude": {
      event: "SessionStart",
      matcher: "startup|clear|compact",
      dispatch: "command",
      command: ".claude-plugin/hooks/session-start.sh",
    },
    ...overrides,
  };
}

function errorsFor(REPO) {
  const ctx = makeCtx(REPO);
  return runHookIntent(ctx).errors;
}

// ── Cases ───────────────────────────────────────────────────────────────────-

test("valid command intent passes (no errors)", () => {
  const REPO = scaffold(
    { "session-start": validIntent() },
    {
      commandFiles: [".claude-plugin/hooks/session-start.sh"],
      pluginHooks: {
        SessionStart: [
          { matcher: "startup|clear|compact", hooks: [{ type: "command", command: "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/hooks/session-start.sh" }] },
        ],
      },
    },
  );
  try {
    assert.deepEqual(errorsFor(REPO), [], "expected no errors for a valid intent");
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("missing required field (description) fails", () => {
  const bad = validIntent();
  delete bad.description;
  const REPO = scaffold({ "session-start": bad }, { commandFiles: [".claude-plugin/hooks/session-start.sh"], pluginHooks: { SessionStart: [{ matcher: "startup|clear|compact", hooks: [{ type: "command", command: "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/hooks/session-start.sh" }] }] } });
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /description must be/.test(e)), `expected a description error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("unknown event fails", () => {
  const bad = validIntent({ "x-claude": { event: "Bogus", dispatch: "command", command: ".claude-plugin/hooks/session-start.sh" } });
  const REPO = scaffold({ "session-start": bad }, { commandFiles: [".claude-plugin/hooks/session-start.sh"] });
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /event "Bogus" not in allowed enum/.test(e)), `expected unknown-event error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("prompt dispatch on SessionStart fails (D3 support table)", () => {
  const bad = validIntent({
    intent: "prompt-type",
    name: "bad-prompt",
    "x-claude": { event: "SessionStart", dispatch: "prompt", prompt: "judge $ARGUMENTS" },
  });
  const REPO = scaffold({ "bad-prompt": bad }, { mdFiles: { "bad-prompt": "---\nkind: hook\nname: bad-prompt\n---\nbody" } });
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /SessionStart does not support dispatch "prompt"/.test(e)), `expected D3 table error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("agent hook without prompt fails (D4)", () => {
  const bad = validIntent({
    intent: "agent-type",
    name: "needs-prompt",
    "x-claude": { event: "PreToolUse", matcher: "Bash", dispatch: "agent" },
  });
  const REPO = scaffold({ "needs-prompt": bad }, { mdFiles: { "needs-prompt": "---\nkind: hook\nname: needs-prompt\n---\nbody" } });
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /agent dispatch requires a non-empty prompt/.test(e)), `expected missing-prompt error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("prompt-injection-guard with enabled:true fails (D7)", () => {
  const bad = validIntent({
    intent: "prompt-injection-guard",
    name: "prompt-injection-guard",
    enabled: true,
    "x-claude": { event: "UserPromptSubmit", dispatch: "command", command: ".claude-plugin/hooks/prompt-injection-guard.mjs" },
  });
  const REPO = scaffold({ "prompt-injection-guard": bad }, { commandFiles: [".claude-plugin/hooks/prompt-injection-guard.mjs"] });
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /must ship enabled:false/.test(e)), `expected D7 enabled error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("claude platform without x-claude fails (host-binding completeness)", () => {
  const bad = validIntent();
  delete bad["x-claude"];
  const REPO = scaffold({ "session-start": bad });
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /x-claude binding is missing/.test(e)), `expected missing-binding error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("judgment hook filename .prompt/.agent infix is stripped for name match (D10)", () => {
  // verify-no-secrets-touched.prompt.json declares name "verify-no-secrets-touched".
  const REPO = mkdtempSync(join(tmpdir(), "aegis-hook-test-"));
  mkdirSync(join(REPO, "hooks"), { recursive: true });
  mkdirSync(join(REPO, ".claude-plugin", "hooks"), { recursive: true });
  writeFileSync(join(REPO, ".claude-plugin", "plugin.json"), JSON.stringify({}, null, 2));
  const intent = validIntent({
    intent: "prompt-type",
    name: "verify-no-secrets-touched",
    "x-claude": { event: "PreToolUse", matcher: "Edit|Write", dispatch: "prompt", prompt: "judge $ARGUMENTS" },
  });
  writeFileSync(join(REPO, "hooks", "verify-no-secrets-touched.prompt.json"), JSON.stringify(intent, null, 2));
  writeFileSync(join(REPO, "hooks", "verify-no-secrets-touched.md"), "---\nkind: hook\nname: verify-no-secrets-touched\n---\nbody");
  try {
    const errs = errorsFor(REPO);
    assert.ok(!errs.some((e) => /must match filename/.test(e)), `infix name should match base, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("judgment hook with name not matching the infix-stripped base fails (D10)", () => {
  const REPO = mkdtempSync(join(tmpdir(), "aegis-hook-test-"));
  mkdirSync(join(REPO, "hooks"), { recursive: true });
  mkdirSync(join(REPO, ".claude-plugin", "hooks"), { recursive: true });
  writeFileSync(join(REPO, ".claude-plugin", "plugin.json"), JSON.stringify({}, null, 2));
  const intent = validIntent({
    intent: "prompt-type",
    name: "wrong-name",
    "x-claude": { event: "PreToolUse", matcher: "Edit", dispatch: "prompt", prompt: "judge $ARGUMENTS" },
  });
  writeFileSync(join(REPO, "hooks", "verify-no-secrets-touched.prompt.json"), JSON.stringify(intent, null, 2));
  writeFileSync(join(REPO, "hooks", "wrong-name.md"), "---\nkind: hook\nname: wrong-name\n---\nbody");
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /must match filename base/.test(e)), `expected filename-base mismatch error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

test("plugin.json drift detected when committed hooks block diverges (D6)", () => {
  const REPO = scaffold(
    { "session-start": validIntent() },
    {
      commandFiles: [".claude-plugin/hooks/session-start.sh"],
      pluginHooks: { SessionStart: [] }, // wrong on purpose
    },
  );
  try {
    const errs = errorsFor(REPO);
    assert.ok(errs.some((e) => /hooks block is out of sync/.test(e)), `expected D6 drift error, got: ${errs.join(" | ")}`);
  } finally { rmSync(REPO, { recursive: true, force: true }); }
});

// ── Runner ────────────────────────────────────────────────────────────────────
const runAll = async () => {
  let passed = 0, failed = 0;
  console.log("TAP version 13");
  console.log(`1..${tests.length}`);
  for (let i = 0; i < tests.length; i++) {
    const { name, fn } = tests[i];
    try {
      await fn();
      passed++;
      console.log(`ok ${i + 1} - ${name}`);
    } catch (err) {
      failed++;
      console.log(`not ok ${i + 1} - ${name}`);
      console.log(`  ---`);
      console.log(`  message: ${String(err && err.message).split("\n").join("\n    ")}`);
      console.log(`  ---`);
    }
  }
  console.log("");
  console.log(`# ${passed} passed, ${failed} failed (of ${tests.length})`);
  if (failed > 0) process.exit(1);
};

runAll();
