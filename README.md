# Aegis

Aegis gives your AI coding agent a curated, portable set of skills, agents, commands, rules, hooks, and templates that load natively in your host. There is no CLI to install, no Bun, and no npx — you add Aegis as a plugin and your host reads the surfaces directly.

Aegis is the plugin-first descendant of [Anvil](https://github.com/hyprtuna/anvil). It carries Anvil's curated content into a portable surface tree that each host loads natively.

## Status

`v0.1.0` — Claude Code, OpenCode, and Codex hosts online. Zed is reachable now via OpenCode ACP (native Zed extension deferred, ~v0.5.0). Cursor is deferred (~v0.5.0).

The surface is intentionally flexible while host plugin tooling evolves — there is no frozen contract yet, and shapes may shift between releases.

## What you get

- **20 skills** — reusable capabilities spanning universal workflows, language practice, and process guidance. Specialist material rides along as 126 on-demand `abilities/` fragments under a parent skill rather than as separate entries in the listing.
- **17 agents** — first-class doers invoked via the host's Task tool.
- **6 commands** — slash-command workflow entry-points.
- **18 rules** — always-loaded iron-law guidance.
- **4 hooks** — portable hook intents with per-host implementations.
- **73 templates** — output skeletons: 22 HTML plus Markdown and JSON siblings; 70 carry slot manifests.
- **9 statusline presets** — ready-to-use status line configurations.
- **5 host adapter projections** — projection notes and gap analyses; 3 are active (Claude Code, OpenCode, Codex).

## Install

Each block below is the short form. The full install and verification flow for every host lives in [`docs/getting-started.md`](docs/getting-started.md).

### Claude Code

```bash
# In Claude Code, add the marketplace, then install the plugin
/plugin marketplace add hyprtuna/aegis
/plugin install aegis@aegis
```

### OpenCode

Symlink the plugin into OpenCode's plugin directory, then restart OpenCode:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sf /path/to/aegis/.opencode/plugins/aegis.js ~/.config/opencode/plugins/aegis.js
```

See `.opencode/INSTALL.local.md` for the full walkthrough. An npm/git-spec
`plugin` array install is unverified for Aegis — see `.opencode/INSTALL.md`.

### Codex

```bash
codex plugin add aegis@git+https://github.com/hyprtuna/aegis.git
```

Restart Codex after adding.

### Other hosts

| Host | Status |
|---|---|
| Zed | reachable now via OpenCode ACP; native Zed extension deferred (~v0.5.0) — see [`docs/getting-started.md`](docs/getting-started.md) |
| Cursor | deferred (~v0.5.0) |

## Documentation

- [`docs/getting-started.md`](docs/getting-started.md) — install and first invocation, per host.
- [`docs/templates-gallery.md`](docs/templates-gallery.md) — the 22 HTML output templates and what each is for.
- [`docs/capability-matrix.md`](docs/capability-matrix.md) — what each surface maps to on every host.

## Source

Aegis is derived from [Anvil](https://github.com/hyprtuna/anvil). Migrated content carries `source: anvil:<path>` provenance in its frontmatter.

## License

MIT (matches Anvil).
