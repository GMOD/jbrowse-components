#!/usr/bin/env bash
input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
start='(^|[;&|(]|&&|\|\|)[[:space:]]*'

refuse() {
  echo "$1" >&2
  exit 2
}

if grep -Eq "${start}git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+stash\b" <<<"$cmd"; then
  refuse 'Refused: git stash. The stash stack is repo-global and other agents pop it. Use a WIP commit, or `git diff main -- <path>`.'
fi
wrapper='((timeout[[:space:]]+[^[:space:]]+|time|nice|nohup|command|env|[A-Za-z_]+=[^[:space:]]*)[[:space:]]+)*'
runner='((npx|pnpm|pnpm exec|pnpm dlx|npm exec)[[:space:]]+)?'
compiler='(([^[:space:]]*/)?(tsc|tsgo)|node[[:space:]]+[^[:space:]]*typescript[^[:space:]]*/bin/tsc)([[:space:]]|$)'
if grep -Eq "${start}${wrapper}${runner}${compiler}" <<<"$cmd"; then
  refuse 'Refused: bare tsc/tsgo. Each whole-repo program is ~4GB; `pnpm typecheck` queues on the machine-wide slots (scripts/heavy-run-slot.sh) so a dozen agents do not swap the box.'
fi
if grep -Eq "${start}npx[[:space:]]+prettier\b" <<<"$cmd"; then
  refuse 'Refused: npx prettier. Formatting is oxfmt — `pnpm format` / `pnpm check-format`.'
fi
if grep -Eq "${start}git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+merge[[:space:]][^|;]*\|([^|]|$)" <<<"$cmd"; then
  refuse 'Refused: a piped git merge. The pipe hands `&&` the last command'"'"'s exit code, so a refused fast-forward runs the next step anyway. Run the merge on its own, then remove the worktree.'
fi

# A merge refused in the same message as the cleanup (parallel calls, a `;`
# chain) still runs the removal, so the check is on the worktree itself.
removal=$(grep -oE "git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+worktree[[:space:]]+remove([[:space:]]+(-f|--force))*[[:space:]]+[^[:space:];&|)]+" <<<"$cmd" | head -1)
if [ -n "$removal" ]; then
  # A relative path resolves against a `cd <dir>` before it, not the session's
  # cwd, which can be the worktree being removed. Every `cd` in the command is
  # a candidate, the cwd too, and any one naming an unlanded worktree refuses.
  repo=$(sed -nE 's/^git[[:space:]]+-C[[:space:]]+([^[:space:]]+).*/\1/p' <<<"$removal")
  repo=${repo//[\"\']/}
  path=${removal##*[[:space:]]}
  path=${path//[\"\']/}
  while IFS= read -r base; do
    base=${base//[\"\']/}
    case $base in '') base=$cwd ;; /*) ;; *) base="$cwd/$base" ;; esac
    from=$repo
    case $from in '' | /*) ;; *) from="$base/$from" ;; esac
    target=$path
    case $target in /*) ;; *) target="${from:-$base}/$target" ;; esac
    if git -C "$target" rev-parse -q --verify HEAD >/dev/null 2>&1 &&
      ! git -C "$target" merge-base --is-ancestor HEAD main 2>/dev/null; then
      refuse "Refused: $target holds commits main lacks. Land them first (the merge alone, then read its result), or ask the user before discarding them."
    fi
  done < <(
    echo
    grep -oE "(^|[;&|(])[[:space:]]*cd[[:space:]]+[^[:space:];&|)]+" <<<"$cmd" |
      sed -E 's/.*cd[[:space:]]+//'
  )
fi
exit 0
