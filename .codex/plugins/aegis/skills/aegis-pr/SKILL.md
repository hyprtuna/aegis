---
name: aegis-pr
description: 'Open a PR (GitHub) or MR (GitLab) — auto-detects'
---

Invoke `github-workflow` or `gitlab-workflow` based on the project's CI/CD config:
- If `.gitlab-ci.yml` exists → `gitlab-workflow`
- Otherwise → `github-workflow`
