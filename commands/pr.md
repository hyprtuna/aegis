---
name: pr
description: Open a PR (GitHub) or MR (GitLab) — auto-detects
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  argument-hint: "[title] [--draft]"
---

Invoke the `git-workflow` skill, then load the host fragment matching the project's CI/CD config:
- If `.gitlab-ci.yml` exists → its `gitlab` fragment (the `glab` CLI)
- Otherwise → its `github` fragment (the `gh` CLI)
