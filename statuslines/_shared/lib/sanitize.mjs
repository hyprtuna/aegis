// sanitize.mjs — strip ALL C0 control chars (0x00-0x1F, including ESC 0x1B and
// TAB 0x09) and 0x7F (DEL) from untrusted stdin/transcript-derived strings
// (AG-0260).
//
// Extracted out of runtime.mjs so statuslines/_shared/lib/transcript.mjs can
// reuse the exact same implementation without importing runtime.mjs — runtime
// imports transcript.mjs for its guarded pre-parse step in run(), so the
// reverse import would be circular. runtime.mjs re-exports `sanitize` from
// here so every existing `import { sanitize } from "./runtime.mjs"` call site
// (e.g. subagent-runtime.mjs) keeps working unchanged.
//
// ESC must NOT survive here: ANSI color and OSC-8 hyperlinks are emitted by
// trusted code (loader.colorize, pr.mjs) which adds its own ESC AFTER
// sanitizing the payload. Leaving ESC in an untrusted field (e.g. a hostile
// git branch name, PR url, or transcript tool-use argument) would allow
// ANSI/SGR, screen-clear, or forged-hyperlink injection into the terminal.
// TAB is stripped too so interpolated fields can't shift fixed-width layout.
export function sanitize(text) {
  if (text == null) return "";
  let s = String(text);
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1F\x7F]/g, "");
  return s;
}
