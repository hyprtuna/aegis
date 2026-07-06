// settings-merger.mjs — implemented in C3.
//
// mergeSettings(existingText, patch) -> string
//
// Merges the top-level keys of `patch` into a JSONC settings document, returning
// the merged TEXT (not a parsed object). Node 20+ stdlib only. No deps.
//
// What IS preserved
// -----------------
//   • All `//` line comments and `/* … */` block comments in `existingText`.
//   • Trailing commas in the existing document.
//   • The original whitespace/formatting of every region the patch does not touch.
//   • Keys absent from `patch` are byte-for-byte untouched.
//
// What changes
// ------------
//   • A top-level key present in BOTH the document and `patch`:
//       - scalar patch value  → the value token is replaced in place (key, its
//         comments, and surrounding layout are preserved).
//       - object patch value  → recursively merged into the existing object value
//         (only the inner keys named by the patch are added/updated; the existing
//         object's other keys and comments are preserved).
//       - array patch value   → REPLACES the existing array wholesale; arrays are
//         never element-merged or unioned.
//   • A top-level key in `patch` but NOT in the document → appended as a new
//     `"key": <json>` entry just before the closing `}` of the root object, using
//     the document's detected indentation.
//
// Honest gaps (Iron Law 6)
// ------------------------
//   • Newly-INSERTED values (appended keys, or object sub-keys that did not exist)
//     are emitted with `JSON.stringify`, so they carry no comments and no trailing
//     commas of their own. Only PRE-EXISTING text retains its comments.
//   • Comment-preservation on UPDATE is positional: a scalar update rewrites only
//     the value token, so a trailing `// comment` on that line survives, but a
//     comment embedded INSIDE a replaced object/array value is not reconstructed
//     (such a key falls back to a recursive object merge or a whole-value rewrite).
//   • The document must be a single JSONC OBJECT at the root. Non-object roots
//     throw.
//   • This is a pragmatic merge, not a full JSONC CST round-trip. It targets the
//     Aegis settings-patch use case (adding a handful of keys to a commented
//     settings.json), not arbitrary JSONC rewriting.

// ── Tolerant JSONC → JS value parser ────────────────────────────────────────
// Hand-rolled so we tolerate `//`, `/* */`, and trailing commas. Returns the
// parsed value; used only for READING existing values (to decide scalar-vs-object
// and to know which keys already exist). The original text is what we edit.
function parseJsonc(text) {
  let i = 0;
  const n = text.length;

  function err(msg) {
    throw new Error(`settings-merger: invalid JSONC at index ${i}: ${msg}`);
  }
  function skipTrivia() {
    while (i < n) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++;
      } else if (c === "/" && text[i + 1] === "/") {
        i += 2;
        while (i < n && text[i] !== "\n") i++;
      } else if (c === "/" && text[i + 1] === "*") {
        i += 2;
        while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
        i += 2;
      } else {
        break;
      }
    }
  }
  function parseValue() {
    skipTrivia();
    const c = text[i];
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    if (c === '"') return parseString();
    if (c === "-" || (c >= "0" && c <= "9")) return parseNumber();
    if (text.startsWith("true", i)) { i += 4; return true; }
    if (text.startsWith("false", i)) { i += 5; return false; }
    if (text.startsWith("null", i)) { i += 4; return null; }
    err(`unexpected token '${c}'`);
  }
  function parseString() {
    i++; // opening quote
    let s = "";
    while (i < n) {
      const c = text[i++];
      if (c === '"') return s;
      if (c === "\\") {
        const e = text[i++];
        if (e === "n") s += "\n";
        else if (e === "t") s += "\t";
        else if (e === "r") s += "\r";
        else if (e === "b") s += "\b";
        else if (e === "f") s += "\f";
        else if (e === "u") { s += String.fromCharCode(parseInt(text.slice(i, i + 4), 16)); i += 4; }
        else s += e;
      } else {
        s += c;
      }
    }
    err("unterminated string");
  }
  function parseNumber() {
    const start = i;
    while (i < n && /[0-9eE+\-.]/.test(text[i])) i++;
    return Number(text.slice(start, i));
  }
  function parseArray() {
    i++; const arr = [];
    skipTrivia();
    if (text[i] === "]") { i++; return arr; }
    while (i < n) {
      arr.push(parseValue());
      skipTrivia();
      if (text[i] === ",") { i++; skipTrivia(); if (text[i] === "]") { i++; return arr; } continue; }
      if (text[i] === "]") { i++; return arr; }
      err("expected ',' or ']'");
    }
    err("unterminated array");
  }
  function parseObject() {
    i++; const obj = {};
    skipTrivia();
    if (text[i] === "}") { i++; return obj; }
    while (i < n) {
      skipTrivia();
      if (text[i] !== '"') err("expected object key string");
      const key = parseString();
      skipTrivia();
      if (text[i] !== ":") err("expected ':'");
      i++;
      // Duplicate keys make the merge ambiguous (the text editor targets the
      // first occurrence, but a parsed map would keep the last) — refuse rather
      // than silently corrupt the document.
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        throw new Error(`settings-merger: duplicate key '${key}' — refusing to merge ambiguous JSONC`);
      }
      obj[key] = parseValue();
      skipTrivia();
      if (text[i] === ",") { i++; skipTrivia(); if (text[i] === "}") { i++; return obj; } continue; }
      if (text[i] === "}") { i++; return obj; }
      err("expected ',' or '}'");
    }
    err("unterminated object");
  }

  skipTrivia();
  const v = parseValue();
  skipTrivia();
  return v;
}

// Detect the indent unit (string of spaces/tabs of the first nested line).
function detectIndent(text) {
  const m = text.match(/\n([ \t]+)\S/);
  return m ? m[1] : "  ";
}

// Find the byte range [start, end) of the VALUE for a given top-level key in a
// root-object document. Returns null if not found. Scans with the same trivia
// rules as the parser so comments/strings don't confuse brace matching.
function findTopLevelValueRange(text, key) {
  let i = 0;
  const n = text.length;
  const skip = () => {
    while (i < n) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else if (c === "/" && text[i + 1] === "/") { i += 2; while (i < n && text[i] !== "\n") i++; }
      else if (c === "/" && text[i + 1] === "*") { i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; }
      else break;
    }
  };
  const readString = () => { // assumes text[i] === '"'; advances past closing quote
    i++;
    while (i < n) { const c = text[i++]; if (c === "\\") i++; else if (c === '"') return; }
  };
  skip();
  if (text[i] !== "{") throw new Error("settings-merger: root document must be a JSON object");
  i++; // into root object
  while (i < n) {
    skip();
    if (text[i] === "}") return null;
    if (text[i] !== '"') return null;
    const keyStart = i;
    readString();
    const thisKey = JSON.parse(text.slice(keyStart, i));
    skip();
    if (text[i] !== ":") return null;
    i++; skip();
    const valStart = i;
    // Read one value, tracking nesting for objects/arrays.
    let depth = 0;
    do {
      const c = text[i];
      if (c === '"') { readString(); continue; }
      if (c === "/" && text[i + 1] === "/") { while (i < n && text[i] !== "\n") i++; continue; }
      if (c === "/" && text[i + 1] === "*") { i += 2; while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        if (depth === 0) break; // hit root-object close before value end (scalar with no comma)
        depth--;
      } else if (c === "," && depth === 0) break;
      i++;
    } while (i < n);
    const valEnd = i; // exclusive; before comma or closing brace
    if (thisKey === key) {
      // Trim trailing whitespace from the value slice so we replace only the token.
      let e = valEnd;
      while (e > valStart && /\s/.test(text[e - 1])) e--;
      return { start: valStart, end: e };
    }
    skip();
    if (text[i] === ",") i++;
  }
  return null;
}

function appendKey(text, key, value, indent) {
  const close = text.lastIndexOf("}");
  if (close < 0) throw new Error("settings-merger: no closing '}' in document");
  const before = text.slice(0, close);
  const after = text.slice(close); // begins at the closing '}'
  // Preserve the closing brace's own-line indentation (text between the last
  // newline of `before` and the brace). For a nested object this keeps the
  // inner `}` aligned with its opener.
  const trimmed = before.replace(/\s*$/, "");
  const lastNl = before.lastIndexOf("\n");
  const closeIndent = lastNl >= 0 ? before.slice(lastNl + 1).replace(/\S.*$/s, "") : "";
  // Entry indent: one level deeper than the closing brace, falling back to the
  // detected unit when the document is flat.
  const entryIndent = closeIndent ? closeIndent + indent : indent;
  const lastNonWs = trimmed[trimmed.length - 1];
  const hasEntries = lastNonWs !== "{";
  const valueText = JSON.stringify(value);
  const newEntry = `${entryIndent}${JSON.stringify(key)}: ${valueText}`;
  if (hasEntries) {
    const needsComma = lastNonWs !== ",";
    const sep = needsComma ? "," : "";
    return `${trimmed}${sep}\n${newEntry}\n${closeIndent}}${after.slice(1)}`;
  }
  // Empty root object: { }  →  {\n  "key": value\n}
  return `${trimmed}\n${newEntry}\n${closeIndent}}${after.slice(1)}`;
}

export function mergeSettings(existingText, patch) {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("settings-merger: patch must be a plain object");
  }
  const existing = parseJsonc(existingText);
  if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
    throw new Error("settings-merger: existing document must be a JSON object");
  }
  const indent = detectIndent(existingText);
  let text = existingText;

  for (const [key, patchVal] of Object.entries(patch)) {
    const existingVal = Object.prototype.hasOwnProperty.call(existing, key) ? existing[key] : undefined;
    const range = findTopLevelValueRange(text, key);

    if (range === null) {
      // Key absent → append it (JSON.stringify; no comments — documented gap).
      text = appendKey(text, key, patchVal, indent);
      continue;
    }

    const bothObjects =
      patchVal !== null && typeof patchVal === "object" && !Array.isArray(patchVal) &&
      existingVal !== null && typeof existingVal === "object" && !Array.isArray(existingVal);

    if (bothObjects) {
      // Recurse into the nested object's TEXT to preserve its inner comments.
      const innerText = text.slice(range.start, range.end);
      const mergedInner = mergeSettings(innerText, patchVal);
      text = text.slice(0, range.start) + mergedInner + text.slice(range.end);
    } else {
      // Scalar / array / type-mismatch → replace just the value token in place.
      const replacement = JSON.stringify(patchVal);
      text = text.slice(0, range.start) + replacement + text.slice(range.end);
    }
  }

  return text;
}

// ── Inline self-tests ────────────────────────────────────────────────────────
// Run: node scripts/lib/settings-merger.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };

  // 1. Adds a new key, preserves comments + trailing comma of existing keys.
  const doc1 = `{
  // user preferences
  "theme": "dark", // trailing comment
  "fontSize": 14,
}`;
  const out1 = mergeSettings(doc1, { telemetry: false });
  assert(out1.includes("// user preferences"), "comment preserved");
  assert(out1.includes('"theme": "dark", // trailing comment'), "trailing comment preserved");
  assert(/"telemetry":\s*false/.test(out1), "new key added");
  console.log("test 1 input:\n" + doc1 + "\n\ntest 1 output:\n" + out1 + "\n");

  // 2. Updates an existing scalar in place, keeping the comment on that line.
  const out2 = mergeSettings(doc1, { fontSize: 16 });
  assert(/"fontSize":\s*16/.test(out2), "scalar updated");
  assert(out2.includes("// user preferences"), "other comments intact");
  console.log("test 2 output:\n" + out2 + "\n");

  // 3. Recursive object merge preserves inner comments.
  const doc3 = `{
  "editor": {
    // inner note
    "tabSize": 2
  }
}`;
  const out3 = mergeSettings(doc3, { editor: { wordWrap: true } });
  assert(out3.includes("// inner note"), "inner comment preserved");
  assert(/"tabSize":\s*2/.test(out3), "untouched inner key intact");
  assert(/"wordWrap":\s*true/.test(out3), "nested key added");
  console.log("test 3 output:\n" + out3 + "\n");

  console.log("settings-merger: all self-tests passed");
}
