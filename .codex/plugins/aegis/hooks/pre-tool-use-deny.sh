#!/usr/bin/env bash
# aegis-hook-version: 0.1.4
# pre-tool-use-deny.sh — Aegis plugin PreToolUse hook (Claude Code).
#
# WHY THIS EXISTS (decisions.md D5 correction): Claude plugins cannot ship a
# declarative permission deny — plugin settings.json supports only
# `agent`/`subagentStatusLine`, there is no plugin.json `permissions` field, and
# agent-frontmatter `disallowedTools` only filters the TOOL POOL (bare tool
# names), not path/arg specifiers (sub-agents.md:269,335; permissions.md:150-164
# recommends a PreToolUse hook for exactly this). So the cross-cutting
# secret/destructive-Bash guardrail in `manifest/permissions.json` `plugin.deny[]`
# is enforced HERE, at runtime, as a real boundary.
#
# Contract (hooks.md): tool-call JSON arrives on stdin
# ({tool_name, tool_input:{command|file_path|...}}); printing a
# hookSpecificOutput with permissionDecision:"deny" blocks the call; exit 0 with
# no output = no decision (normal permission flow continues).
#
# Source of truth: the secret-file paths are read from plugin.deny at runtime, so
# adding a Read(...) deny to the manifest is auto-enforced. The destructive-Bash
# matchers (rm-rf of root/home, pipe-to-shell) are hardened in this script and
# correspond to plugin.deny's Bash(...) entries; adding a NEW Bash deny *category*
# requires updating this script (the validator can be extended to check this).
set -u

INPUT="$(cat)"

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# jq is a documented Aegis dependency (statuslines, monitors). If it is missing we
# cannot inspect the call; allow (defense-in-depth: the per-agent tools allowlist
# is the primary boundary and is enforced by the host regardless). NOT silent — we
# warn on stderr so the degradation is visible.
if ! command -v jq >/dev/null 2>&1; then
  echo "aegis pre-tool-use-deny: jq not found; cross-cutting deny not enforced this call" >&2
  exit 0
fi

TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')"
# Resolve the deny config: script-relative first (for Codex, where the script is
# bundled next to a permissions.json copy), then fall back to the CLAUDE_PLUGIN_ROOT
# path (for Claude Code, where CLAUDE_PLUGIN_ROOT points at the installed plugin root).
PLUGIN_DENY="$(dirname "$0")/permissions.json"
[ -f "$PLUGIN_DENY" ] || PLUGIN_DENY="${CLAUDE_PLUGIN_ROOT:-.}/manifest/permissions.json"

case "$TOOL" in
  Read|Edit|Write|MultiEdit|NotebookEdit)
    FP="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')"
    [ -n "$FP" ] || exit 0
    base="${FP##*/}"
    # Read the Read(...) deny inners from the manifest (single source of truth).
    [ -f "$PLUGIN_DENY" ] || exit 0
    while IFS= read -r inner; do
      [ -n "$inner" ] || continue
      norm="${inner/#\~/$HOME}"   # expand leading ~
      norm="${norm#./}"          # strip leading ./
      if [[ "$norm" == */'**' ]]; then
        # Directory deny (e.g. secrets/**, ~/.ssh/**): match the dir segment anywhere.
        dir="${norm%/**}"
        seg="${dir##*/}"         # last path segment, e.g. secrets, .ssh
        if [[ "/$FP/" == *"/$seg/"* ]]; then
          deny "Aegis: reading '$FP' is denied (matches plugin.deny '$inner')."
        fi
      elif [[ "$norm" == *'*'* ]]; then
        # Filename glob (e.g. .env.*, credentials.*): match basename.
        # shellcheck disable=SC2053
        if [[ "$base" == ${norm##*/} ]]; then
          deny "Aegis: reading '$FP' is denied (matches plugin.deny '$inner')."
        fi
      else
        # Exact file (e.g. .env, credentials.json): basename or path suffix.
        if [[ "$base" == "${norm##*/}" || "$FP" == *"/$norm" || "$FP" == "$norm" ]]; then
          deny "Aegis: reading '$FP' is denied (matches plugin.deny '$inner')."
        fi
      fi
    done < <(jq -r '.plugin.deny[]? | select(startswith("Read(") or startswith("Edit(") or startswith("Write(")) | sub("^[A-Za-z]+\\(";"") | sub("\\)$";"")' "$PLUGIN_DENY" 2>/dev/null)
    exit 0
    ;;
  Bash)
    CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')"
    [ -n "$CMD" ] || exit 0
    # Destructive root/home wipe: `rm -rf /`, `rm -rf /*`, `rm -rf ~`, `rm -rf $HOME`.
    if printf '%s' "$CMD" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*[[:space:]]+(/([[:space:]]|$|\*)|~([[:space:]]|/|$)|"?\$HOME)'; then
      deny "Aegis: destructive 'rm -rf' of root/home is denied (plugin.deny)."
    fi
    # Pipe-to-shell remote exec: `curl ... | sh|bash`, `wget ... | sh|bash`.
    if printf '%s' "$CMD" | grep -Eq '(curl|wget)[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash)([[:space:]]|$)'; then
      deny "Aegis: piping a download into a shell is denied (plugin.deny)."
    fi

    # ---- protected-branch git guard --------------------------------------------
    # Block commit/push to protected branches and destructive git ops. Config
    # (protected branches, op flags, override env/marker) is read from
    # plugin.gitGuard in the manifest, falling back to safe defaults so a missing
    # or malformed config NEVER crashes the session (fail open). Mirrors hr-dev's
    # git-guard: regex classification, auditable override, "do not work around"
    # messaging. Only commands that actually invoke git are inspected.
    # Best-effort limit: branch resolution uses the tool-call cwd,
    # so `git -C <other-repo> commit/push` is classified by op but NOT branch-checked
    # against the -C target. Defense-in-depth, not a sandbox; documented as a gap.
    if printf '%s' "$CMD" | grep -Eq '(^|[[:space:];&|(])git([[:space:]]|$)'; then
      # Override config (defaults if manifest is absent/unreadable).
      GUARD_ENV="AEGIS_ALLOW_GIT_GUARD"
      GUARD_MARKER="# aegis:allow-git"
      if [ -f "$PLUGIN_DENY" ]; then
        e="$(jq -r '.plugin.gitGuard.override.env // "AEGIS_ALLOW_GIT_GUARD"' "$PLUGIN_DENY" 2>/dev/null)"
        m="$(jq -r '.plugin.gitGuard.override.marker // "# aegis:allow-git"' "$PLUGIN_DENY" 2>/dev/null)"
        [ -n "$e" ] && [ "$e" != "null" ] && GUARD_ENV="$e"
        [ -n "$m" ] && [ "$m" != "null" ] && GUARD_MARKER="$m"
      fi

      # Auditable override: env-var prefix in the command OR a trailing marker.
      # Both require an explicit, visible token in the command the user approved.
      if printf '%s' "$CMD" | grep -Eq "(^|[[:space:];&|(])${GUARD_ENV}=1([[:space:]]|$)"; then
        exit 0
      fi
      if printf '%s' "$CMD" | grep -Fq "$GUARD_MARKER"; then
        exit 0
      fi

      git_deny() {
        deny "Aegis git guard: $1 The user must explicitly approve this; do not work around this guard. STOP and ask the user. To proceed once approved, re-run with ${GUARD_ENV}=1 prefixed, or append '${GUARD_MARKER}' to the command."
      }

      # Protected-branch list (default main/master). Build an alternation regex.
      PROT_RE='main|master'
      if [ -f "$PLUGIN_DENY" ]; then
        pl="$(jq -r '.plugin.gitGuard.protectedBranches // [] | join("|")' "$PLUGIN_DENY" 2>/dev/null)"
        [ -n "$pl" ] && [ "$pl" != "null" ] && PROT_RE="$pl"
      fi
      # Match a branch name against the protected set (strip refs/heads/ and origin/).
      is_protected() {
        b="$1"; b="${b#refs/heads/}"; b="${b#origin/}"
        [ -n "$b" ] || return 1
        printf '%s' "$b" | grep -Eq "^(${PROT_RE})(/.*)?$"
      }
      # Resolve the current branch (best-effort; empty on any failure → not
      # protected). Honors the optional `cwd` from the tool-call JSON, matching
      # the host contract, so the branch is resolved in the agent's working dir.
      GIT_CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // ""' 2>/dev/null)"
      cur_branch() {
        if [ -n "$GIT_CWD" ] && [ -d "$GIT_CWD" ]; then
          git -C "$GIT_CWD" rev-parse --abbrev-ref HEAD 2>/dev/null
        else
          git rev-parse --abbrev-ref HEAD 2>/dev/null
        fi
      }

      is_push=false;  printf '%s' "$CMD" | grep -Eq '\bgit[[:space:]]+push\b'   && is_push=true
      is_commit=false; printf '%s' "$CMD" | grep -Eq '\bgit[[:space:]]+commit\b' && is_commit=true

      # Force push.
      if [ "$is_push" = true ] && printf '%s' "$CMD" | grep -Eq '(--force-with-lease\b|--force\b|(^|[[:space:]])-[A-Za-z]*f([A-Za-z]*)?([[:space:]]|$))'; then
        git_deny "force-push (--force / -f / --force-with-lease) can overwrite remote history."
      fi
      # Hard reset.
      if printf '%s' "$CMD" | grep -Eq '\bgit[[:space:]]+reset\b.*--hard\b'; then
        git_deny "'git reset --hard' discards commits and working-tree changes."
      fi
      # git restore (discards working-tree changes). `--staged` WITHOUT
      # `--worktree` only unstages (touches the index, not the working tree), so
      # it is not destructive and is allowed.
      if printf '%s' "$CMD" | grep -Eq '\bgit[[:space:]]+restore\b'; then
        if printf '%s' "$CMD" | grep -Eq '(^|[[:space:]])--staged\b' && \
           ! printf '%s' "$CMD" | grep -Eq '(^|[[:space:]])--worktree\b'; then
          : # staged-only unstage, not destructive
        else
          git_deny "'git restore' discards working-tree changes."
        fi
      fi
      # checkout that discards: `git checkout -- <path>` or `git checkout .`
      if printf '%s' "$CMD" | grep -Eq '\bgit[[:space:]]+checkout\b.*(--[[:space:]]|[[:space:]]\.([[:space:]]|$))'; then
        git_deny "'git checkout -- <path>' / 'git checkout .' discards working-tree changes."
      fi
      # git clean.
      if printf '%s' "$CMD" | grep -Eq '\bgit[[:space:]]+clean\b.*(^|[[:space:]])-[A-Za-z]*f'; then
        git_deny "'git clean -f' deletes untracked files."
      fi

      # Commit on a protected branch.
      if [ "$is_commit" = true ]; then
        if is_protected "$(cur_branch)"; then
          git_deny "commit on protected branch '$(cur_branch)'. Work on a feature/ticket branch instead."
        fi
      fi

      # Push to a protected branch (named refspec destination, or bare push while
      # the current branch is protected, e.g. `git push origin HEAD:main`).
      if [ "$is_push" = true ]; then
        after="${CMD#*git*push}"
        named_protected=false
        for tok in $after; do
          case "$tok" in
            -*) continue ;;
          esac
          dest="$tok"
          case "$dest" in
            *:*) dest="${dest##*:}" ;;
          esac
          if is_protected "$dest"; then named_protected=true; break; fi
        done
        if [ "$named_protected" = true ]; then
          git_deny "push to a protected branch (${PROT_RE})."
        else
          # No explicit protected destination named. A bare push (no positional
          # refspec other than the remote) pushes the current branch — deny if it
          # is protected.
          set -- $after
          has_refspec=false
          # skip the remote (first positional) then look for a branch refspec
          first_positional_seen=false
          for tok in "$@"; do
            case "$tok" in -*) continue ;; esac
            if [ "$first_positional_seen" = false ]; then first_positional_seen=true; continue; fi
            [ "$tok" = "HEAD" ] && continue
            has_refspec=true
          done
          if [ "$has_refspec" = false ] && is_protected "$(cur_branch)"; then
            git_deny "push of protected branch '$(cur_branch)'."
          fi
        fi
      fi
    fi
    # ---- end git guard --------------------------------------------------------
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
