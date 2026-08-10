#!/usr/bin/env bash
# WorktreeCreate hook: CREATE a git worktree and make it usable.
#
# Read the contract before editing, because it is not the usual hook contract
# and getting it wrong breaks EnterWorktree for every session in the repo.
#
# A WorktreeCreate hook does not run *alongside* the runtime's own worktree
# creation — it REPLACES it. The runtime delegates the whole job and then reads
# the resulting path from the hook's STDOUT:
#
#     "hook succeeded but returned no worktree path
#      (command: echo the path to stdout; ...)"
#
# So this script owns `git worktree add`, and stdout carries exactly one thing:
# the absolute path of the worktree, on the last line, and nothing else. Every
# diagnostic goes to the log.
#
# Three ways this has actually broken:
#
# 1. Printing `{"systemMessage":...}` — the right reply for almost every other
#    hook event — makes the runtime treat that JSON as the path. The session
#    chdir'd into a directory literally named
#    `{"systemMessage":"worktree ready: pnpm install complete"}` and died on
#    ENOENT.
# 2. Printing nothing at all fails the hook outright ("returned no worktree
#    path"), which is what a script that only ran `pnpm install` did.
# 3. Taking the target directory from the payload's `cwd`. The payload has no
#    worktree path in it — there is no worktree yet, that is the point — only
#    `name` and a `cwd` that is the PRIMARY CHECKOUT. A `// .cwd` fallback
#    therefore ran `pnpm install` in the shared tree every other agent is
#    working in, on all 15 real invocations, while logging "Already up to date"
#    in 150ms and looking like success.
#
# Base ref: local `main`, deliberately. The runtime's own default is
# `worktree.baseRef: fresh`, i.e. `origin/<default-branch>`, and this repo runs
# ~70 commits ahead of `origin/main` — branching there would start every
# worktree that far behind and make the ff-only landing in CLAUDE.md impossible.
#
# Test it end to end (this really does create a worktree; remove it after):
#   echo "{\"cwd\":\"$PWD\",\"name\":\"hooktest\"}" | .claude/hooks/setup-worktree.sh
#   git worktree remove .claude/worktrees/hooktest && git branch -d worktree-hooktest
set -uo pipefail

payload=$(cat)
log=~/.claude/worktree-hook.log

note() { printf '%s\n' "$*" >>"$log" 2>/dev/null; }
field() { printf '%s' "$payload" | jq -r "$1" 2>/dev/null; }

repo=$(field '.cwd // empty')
repo=${repo:-${CLAUDE_PROJECT_DIR:-$PWD}}
name=$(field '.name // empty')

note "--- $(date -Is) ---"
note "repo:    $repo"
note "name:    ${name:-<none>}"
note "payload: $payload"

if [ -z "$name" ]; then
  name="wt-$(date +%s)-$$"
  note "no name in payload, generated: $name"
fi

dir="$repo/.claude/worktrees/$name"
branch="worktree-$name"

# Never let the target collapse onto the shared checkout — that is bug 3 above.
if [ "$(cd "$dir" 2>/dev/null && pwd -P)" = "$(cd "$repo" 2>/dev/null && pwd -P)" ]; then
  note "ABORT: $dir resolves to the primary checkout"
  exit 1
fi

# Create the worktree unless a previous run already did. `git worktree add`
# refuses an existing directory, and reusing one is the idempotent answer for a
# retried EnterWorktree.
if [ -e "$dir/.git" ]; then
  note "reusing existing worktree at $dir"
else
  base=main
  git -C "$repo" show-ref --verify --quiet "refs/heads/$base" || base=HEAD
  # An existing branch is checked out as is, NOT re-branched from $base, so a
  # reused name resumes that branch's commits. The log line below says which.
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch"; then
    from="existing $branch"
    add_out=$(git -C "$repo" worktree add "$dir" "$branch" 2>&1) || add_rc=$?
  else
    from="$base"
    add_out=$(git -C "$repo" worktree add "$dir" -b "$branch" "$base" 2>&1) || add_rc=$?
  fi
  if [ "${add_rc:-0}" -ne 0 ]; then
    note "ABORT: git worktree add failed ($add_rc)"
    note "$add_out"
    exit 1
  fi
  note "created $dir on $branch from $from"
fi

# A worktree is a bare checkout: no node_modules, and none of the files
# postinstall generates (products/jbrowse-web/src/buildInfo.ts among them, which
# a fresh worktree otherwise fails `tsc` on, taking ~5 suites with it).
# Symlinking the main checkout's root node_modules is NOT enough for a pnpm
# workspace: each package's deps, including the workspace links between
# packages, live in <pkg>/node_modules, so with only the root linked every
# @jbrowse/* import resolves back into the MAIN checkout's sources and a
# whole-repo typecheck passes without ever seeing your edit.
if [ -f "$dir/pnpm-lock.yaml" ]; then
  if [ -L "$dir/node_modules" ]; then
    rm -f "$dir/node_modules"
  fi
  if (cd "$dir" && pnpm install --frozen-lockfile) >>"$log" 2>&1; then
    note "OK: pnpm install complete"
  else
    note "WARN: pnpm install failed - run it in $dir yourself"
  fi
else
  note "no pnpm-lock.yaml in $dir, skipping install"
fi

# The contract: the path, alone, on stdout. Nothing above this line may print.
printf '%s\n' "$dir"
