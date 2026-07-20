---
name: aegis-pr
description: 'Open a PR (GitHub) or MR (GitLab) — auto-detects'
---

Invoke the `git-workflow` skill, then load the host fragment matching the project's CI/CD config:
- If `.gitlab-ci.yml` exists → its `gitlab` fragment (the `glab` CLI)
- Otherwise → its `github` fragment (the `gh` CLI)
