// subagent-runtime.mjs — bulletproof runtime for Claude Code's
// `subagentStatusLine`. See subagent-contract.md for the full contract.
//
// CONTRACT SUMMARY
//   stdin : a single JSON object { columns, tasks: [ {id, name, status, ...} ] }
//   stdout: one JSON line per overridden row: {"id": "<id>", "content": "<body>"}
//           - omit a line to keep a row's default rendering
//           - empty content hides the row
//
// ARGV CONTRACT
//   node subagent-runtime.mjs <themeName?>
//   argv[2] = optional theme name (defaults to "mono"). No descriptor: subagent
//   rows are a fixed format, not preset-composed.
//
// Shares the bulletproof primitives from runtime.mjs: 400ms stdin timeout,
// sanitize(), process.exit(0) in finally. On any failure it emits nothing
// (an empty stdout is valid here — Claude Code keeps the default rows) and
// exits 0, never stderr noise.

import { sanitize, fmt } from "./runtime.mjs";
import { loadTheme } from "./themes/loader.mjs";
import { fileURLToPath } from "node:url";

const STDIN_TIMEOUT_MS = 400;

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(buf);
    };
    const timer = setTimeout(finish, STDIN_TIMEOUT_MS);
    if (timer.unref) timer.unref();
    try {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => {
        buf += c;
      });
      process.stdin.on("end", () => {
        clearTimeout(timer);
        finish();
      });
      process.stdin.on("error", () => {
        clearTimeout(timer);
        finish();
      });
      process.stdin.resume();
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

// Render one task row body. Returns a string (possibly empty to hide).
export function renderTask(task, theme) {
  const name = task.name || task.label || task.type || "agent";
  let body = theme.colorize(`@${sanitize(name)}`, "accent");

  const status = task.status;
  if (status) body += ` ${theme.colorize(sanitize(String(status)), "muted")}`;

  const tokens = Number(task.tokenCount);
  if (Number.isFinite(tokens) && tokens > 0) {
    body += ` ${theme.colorize(fmt.k(tokens), "muted")}`;
  }
  return body;
}

export async function run(themeName = process.argv[2]) {
  const out = [];
  try {
    const raw = await readStdin();
    let data;
    try {
      data = raw && raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    const theme = loadTheme(themeName || "mono");
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];

    for (const task of tasks) {
      if (!task || typeof task !== "object" || task.id == null) continue;
      let content = "";
      try {
        content = renderTask(task, theme);
      } catch {
        content = "";
      }
      out.push(JSON.stringify({ id: String(task.id), content }));
    }
  } catch {
    // swallow — empty stdout keeps Claude Code's default rows
  } finally {
    try {
      if (out.length > 0) process.stdout.write(`${out.join("\n")}\n`);
    } catch {
      // nothing more we can do
    }
    process.exit(0);
  }
}

const invokedDirectly = (() => {
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();
if (invokedDirectly) run();
