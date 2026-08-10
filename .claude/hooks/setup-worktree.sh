#!/usr/bin/env bash
# WorktreeCreate hook: make a freshly created git worktree actually usable.
#
# A worktree is a bare checkout — it has no node_modules and none of the files
# `postinstall` generates (`products/jbrowse-web/src/buildInfo.ts` among them,
# which is why a fresh worktree otherwise fails `tsc` and takes ~5 suites with
# it). Symlinking the main checkout's root node_modules is NOT enough for a pnpm
# workspace: each package's dependencies, including the workspace links between
# them, live in `<pkg>/node_modules`, so with only the root linked tsc resolves
# every `@jbrowse/*` import back into the MAIN checkout's sources and a whole-
# repo typecheck passes without ever seeing your edit. `pnpm install` builds the
# real symlink farm and runs postinstall; with a warm store it is a few seconds.
#
# TWO THINGS THIS HOOK MUST NOT DO. It did both until 2026-08-10, and neither
# announced itself:
#
# 1. WRITE TO STDOUT. The runtime reads a WorktreeCreate hook's stdout as the
#    worktree PATH — that is the channel by which this hook is allowed to create
#    the directory itself for non-git projects. A `{"systemMessage":...}` reply,
#    which is the correct shape for nearly every other hook event, therefore
#    became a path: the session tried to chdir into a directory literally named
#    `{"systemMessage":"worktree ready: pnpm install complete"}`, died on ENOENT,
#    and lost the worktree. Say nothing on stdout. Log instead.
#
# 2. FALL BACK TO THE PAYLOAD'S `cwd`. The payload carries no worktree path at
#    all — only `name`, alongside a `cwd` that is the PRIMARY CHECKOUT. So a
#    `// .cwd` fallback aims `pnpm install` at the shared tree every other agent
#    is working in. It did that on all 15 real invocations before anyone looked,
#    and it never once installed into a worktree; the giveaway that should have
#    been suspicious is a log full of "Already up to date" in 150ms. The path has
#    to be rebuilt from `cwd` + `name`, and the install refuses to run anywhere
#    that resolves back to `cwd`.
#
# Test it without creating a worktree — this should SKIP, not install:
#   echo "{\"cwd\":\"$PWD\",\"name\":\"scratch\"}" | .claude/hooks/setup-worktree.sh
#   tail ~/.claude/worktree-hook.log
set -uo pipefail

payload=$(cat)
log=~/.claude/worktree-hook.log

note() { printf '%s\n' "$*" >>"$log" 2>/dev/null; }
field() { printf '%s' "$payload" | jq -r "$1" 2>/dev/null; }

base=$(field '.cwd // empty')
base=${base:-${CLAUDE_PROJECT_DIR:-$PWD}}
name=$(field '.name // empty')

# Prefer an explicit path if the runtime ever starts sending one; otherwise
# rebuild it, because `.claude/worktrees/<name>` is where EnterWorktree puts it.
dir=$(field '.worktree_path // .worktreePath // .path // .worktree // empty')
if [ -z "$dir" ] && [ -n "$name" ]; then
  dir="$base/.claude/worktrees/$name"
fi

note "--- $(date -Is) ---"
note "base:         $base"
note "name:         ${name:-<none>}"
note "resolved dir: ${dir:-<none>}"
note "payload:      $payload"

if [ -z "$dir" ]; then
  note "SKIP: payload carried neither a worktree path nor a name"
  exit 0
fi

# The guard the `.cwd` fallback was missing: never install into the shared tree.
if [ "$(cd "$dir" 2>/dev/null && pwd -P)" = "$(cd "$base" 2>/dev/null && pwd -P)" ]; then
  note "SKIP: $dir is the primary checkout, not a worktree"
  exit 0
fi

# The runtime may still be checking the worktree out when this fires, so give
# the directory a bounded moment to appear before giving up on it.
waited=0
while [ ! -f "$dir/pnpm-lock.yaml" ] && [ "$waited" -lt 40 ]; do
  sleep 0.25
  waited=$((waited + 1))
done
note "waited:       $((waited * 250))ms for the checkout"

if [ ! -f "$dir/pnpm-lock.yaml" ]; then
  note "SKIP: no pnpm-lock.yaml in $dir - the runtime may create the worktree after the hook"
  exit 0
fi

# A stale symlink here would make pnpm try to remove the main checkout's
# node_modules; it aborts rather than doing so, but clear it either way.
if [ -L "$dir/node_modules" ]; then
  rm -f "$dir/node_modules"
fi

if (cd "$dir" && pnpm install --frozen-lockfile) >>"$log" 2>&1; then
  note "OK: pnpm install complete in $dir"
else
  note "FAILED: run 'pnpm install --frozen-lockfile' in $dir yourself"
fi
exit 0
