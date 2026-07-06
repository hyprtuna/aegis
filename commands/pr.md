---
kind: command
name: pr
description: Open a PR (GitHub) or MR (GitLab) — auto-detects
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  argument-hint: "[title] [--draft]"
---

Invoke `github-workflow` or `gitlab-workflow` based on the project's CI/CD config:
- If `.gitlab-ci.yml` exists → `gitlab-workflow`
- Otherwise → `github-workflow`
