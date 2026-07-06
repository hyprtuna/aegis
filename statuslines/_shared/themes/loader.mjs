// loader.mjs — load + validate a statusline palette, return a resolved theme
// with a colorize(text, colorKey) helper.
//
// Color value forms accepted (per statusline-theme.schema.json):
//   - named ANSI string: "dim", "red", "green", "yellow", "blue", "magenta",
//     "cyan", "white", "gray", "brightBlue", "brightMagenta", ...
//   - 256-color index: integer 0-255  -> \x1b[38;5;Nm
//   - truecolor hex:   "#rrggbb"       -> \x1b[38;2;r;g;bm
//
// The `mono` theme suppresses all color: colorize() returns the text unchanged
// for every key EXCEPT `label`, which is rendered dim.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const THEMES_DIR = dirname(fileURLToPath(import.meta.url));

const RESET = "\x1b[0m";

// Standard SGR foreground codes for named colors.
const NAMED = {
  default: 39,
  dim: 2, // SGR 2 = faint; rendered as a prefix attribute, reset by 0
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightBlack: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
};

function ansiFor(value) {
  // Returns the opening SGR sequence for a color value, or "" if no color.
  if (value == null) return "";
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255) {
    return `\x1b[38;5;${value}m`;
  }
  if (typeof value === "string") {
    const hex = /^#([0-9a-fA-F]{6})$/.exec(value);
    if (hex) {
      const n = parseInt(hex[1], 16);
      const r = (n >> 16) & 0xff;
      const g = (n >> 8) & 0xff;
      const b = n & 0xff;
      return `\x1b[38;2;${r};${g};${b}m`;
    }
    if (value === "dim") return "\x1b[2m";
    if (value === "default") return ""; // no color
    if (Object.prototype.hasOwnProperty.call(NAMED, value)) {
      return `\x1b[${NAMED[value]}m`;
    }
  }
  return "";
}

// Load a named palette JSON. Falls back to a minimal mono theme on any failure
// so the runtime never throws from theming.
export function loadTheme(name) {
  const safeName = typeof name === "string" && /^[a-z][a-z0-9-]*$/.test(name) ? name : "mono";
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(THEMES_DIR, `${safeName}.json`), "utf8"));
  } catch {
    raw = { name: "mono", colors: { label: "dim" } };
  }
  if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || !raw.colors || typeof raw.colors !== "object") {
    raw = { name: "mono", colors: { label: "dim" } };
  }

  const colors = raw.colors;
  const isMono = raw.name === "mono";
  const bar = {
    filled: (raw.bar && typeof raw.bar.filled === "string" && raw.bar.filled) || "█",
    empty: (raw.bar && typeof raw.bar.empty === "string" && raw.bar.empty) || "░",
  };

  // colorize(text, key): wrap text in the SGR for colors[key]. In mono mode,
  // only `label` is styled (dim); everything else passes through.
  function colorize(text, key) {
    const str = String(text);
    if (isMono) {
      if (key === "label") return `\x1b[2m${str}${RESET}`;
      return str;
    }
    const open = ansiFor(colors[key]);
    if (!open) return str;
    return `${open}${str}${RESET}`;
  }

  return { name: raw.name, colors, bar, isMono, colorize };
}

export { RESET, ansiFor };
