#!/usr/bin/env bash
cmd=$(jq -r '.tool_input.command // empty')
start='(^|[;&|(]|&&|\|\|)[[:space:]]*'

refuse() {
  echo "$1" >&2
  exit 2
}

if grep -Eq "${start}git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+stash\b" <<<"$cmd"; then
  refuse 'Refused: git stash. The stash stack is repo-global and other agents pop it. Use a WIP commit, or `git diff main -- <path>`.'
fi
if grep -Eq "${start}((npx|pnpm|pnpm exec|pnpm dlx)[[:space:]]+)?(tsc|tsgo)\b" <<<"$cmd"; then
  refuse 'Refused: bare tsc/tsgo. Each whole-repo program is ~4GB; `pnpm typecheck` queues on the machine-wide slots (scripts/heavy-run-slot.sh) so a dozen agents do not swap the box.'
fi
if grep -Eq "${start}npx[[:space:]]+prettier\b" <<<"$cmd"; then
  refuse 'Refused: npx prettier. Formatting is oxfmt — `pnpm format` / `pnpm check-format`.'
fi
exit 0
