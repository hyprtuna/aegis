// tool-name-leak.mjs — A3: flag Claude-specific tool names leaking into prose.
//
// Targets canonical skill bodies (skills/**/SKILL.md, skills/**/abilities/*.md)
// and agents/*.md bodies. Strips fenced code blocks first (linting inside fences
// produces too many false positives per research). Emits ONE aggregated warning
// per file listing the leaked tool names — not one per occurrence.
//
// False-positive control: Read/Edit/Task/Bash are common English/proper words, so
// we only flag HIGH-CONFIDENCE references: backtick-wrapped (`Read`), the exact
// token immediately followed by " tool" or "()", or a "use the <Tool>"
// construction. This produces meaningful signal (~11 files on the current tree),
// not a flood. Warn-only; must run in <5s. Tuned to stay well under the 40-file
// flood threshold.
export const id = "TOOL_NAME_LEAK";

const TOOLS = [
  "Read",
  "Edit",
  "Bash",
  "Grep",
  "Glob",
  "Task",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
];

const REWRITE = {
  Read: 'read the file',
  Edit: 'edit the file',
  Bash: 'run the command',
  Grep: 'search the code',
  Glob: 'match files by pattern',
  Task: 'dispatch a subagent',
  TodoWrite: 'track tasks',
  WebFetch: 'fetch a URL',
  WebSearch: 'search the web',
};

// Precompile one high-confidence detector per tool.
const DETECTORS = TOOLS.map((tool) => ({
  tool,
  re: new RegExp(
    "(`" + tool + "`)" + // backtick-wrapped
      "|(\\b" + tool + "\\s+tool\\b)" + // "<Tool> tool"
      "|(\\b" + tool + "\\(\\))" + // "<Tool>()"
      "|(\\buse the " + tool + "\\b)", // "use the <Tool>"
  ),
}));

export function run(ctx) {
  const { files, rel } = ctx;
  const errors = [];
  const warnings = [];

  const targets = files.filter((p) => {
    const r = rel(p);
    return (
      /^skills\/[^/]+\/[^/]+\/SKILL\.md$/.test(r) ||
      /^skills\/[^/]+\/[^/]+\/abilities\/[^/]+\.md$/.test(r) ||
      (/^agents\/[^/]+\.md$/.test(r) && !/AGENTS|CLAUDE/.test(r))
    );
  });

  for (const f of targets) {
    const body = ctx.stripFences(ctx.read(f));
    const found = [];
    for (const { tool, re } of DETECTORS) {
      if (re.test(body)) found.push(tool);
    }
    if (found.length === 0) continue;
    const suggestions = found.map((t) => `${t} → "${REWRITE[t]}"`).join("; ");
    warnings.push(
      `${rel(f)} references Claude-specific tool name(s) in prose: ${found.join(", ")}. Prefer host-neutral phrasing (${suggestions}).`,
    );
  }

  return { errors, warnings };
}
