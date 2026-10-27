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
# chain) still runs the removal, so the check is on the worktree itself. Git
# takes a worktree by any path to it or by its path's unique trailing
# components (`git worktree remove my-branch`), so the hook matches each
# non-option word after `remove` against `git worktree list`. A relative path
# resolves against the cwd, which can be the worktree being removed, or a
# `cd`/`pushd` in the command, each alone and stacked on the ones before it,
# then any `-C`. Any reading that names an unlanded worktree refuses.
# A fragment cut from inside a quoted `bash -c '…'` has unbalanced quotes,
# which xargs refuses, so it splits on whitespace with the quotes dropped.
words() {
  xargs printf '%s\n' <<<"$1" 2>/dev/null || tr -d "\"'" <<<"$1" | tr -s '[:space:]' '\n'
}
expand() {
  local p=$1
  case $p in '~') p=$HOME ;; '~/'*) p=$HOME/${p:2} ;; esac
  case $p in /*) ;; *) p=$2/$p ;; esac
  realpath -m -- "$p"
}
removals=$(grep -oE "\bgit[[:space:]]([^;&|)]*[[:space:]])?worktree[[:space:]]+remove\b[^;&|)]*" <<<"$cmd")
if [ -n "$removals" ]; then
  bases=("$(expand "$cwd" /)")
  stacked=${bases[0]}
  while IFS= read -r dir; do
    case $dir in '' | -*) continue ;; esac
    bases+=("$(expand "$dir" "$cwd")")
    stacked=$(expand "$dir" "$stacked")
    bases+=("$stacked")
  done < <(
    grep -oE "(^|[;&|('\"])[[:space:]]*(cd|pushd)[[:space:]]+[^;&|)]+" <<<"$cmd" |
      sed -E 's/.*(cd|pushd)[[:space:]]+//' |
      while IFS= read -r rest; do words "$rest" | head -1; done
  )
  while IFS= read -r removal; do
    mapfile -t ws < <(words "$removal")
    repos=()
    paths=()
    after=
    for ((i = 0; i < ${#ws[@]}; i++)); do
      if [ -n "$after" ]; then
        case ${ws[i]} in -*) ;; *) paths+=("${ws[i]}") ;; esac
      elif [ "${ws[i]}" = -C ]; then
        repos+=("${ws[++i]}")
      elif [ "${ws[i]}" = remove ] && [ "$i" -gt 0 ] && [ "${ws[i - 1]}" = worktree ]; then
        after=1
      fi
    done
    targets=()
    dirs=()
    for base in "${bases[@]}"; do
      from=$base
      for r in "${repos[@]}"; do from=$(expand "$r" "$from"); done
      dirs+=("$from")
      for p in "${paths[@]}"; do
        targets+=("$(expand "$p" "$from")")
        dirs+=("${targets[-1]}")
      done
    done
    while IFS= read -r wt; do
      real=$(realpath -m -- "$wt")
      named=
      for t in "${targets[@]}"; do [ "$real" = "$t" ] && named=1; done
      for p in "${paths[@]}"; do
        suffix=$(sed -E 's#^(\./)+##; s#/+$##' <<<"$p")
        case /$suffix/ in //* | */./* | */../*) ;; *) [[ $wt == */"$suffix" ]] && named=1 ;; esac
      done
      if [ -n "$named" ] && git -C "$wt" rev-parse -q --verify HEAD >/dev/null 2>&1 &&
        ! git -C "$wt" merge-base --is-ancestor HEAD main 2>/dev/null; then
        refuse "Refused: $wt holds commits main lacks. Land them first (the merge alone, then read its result), or ask the user before discarding them."
      fi
    done < <(
      printf '%s\n' "${dirs[@]}" | sort -u |
        while IFS= read -r d; do git -C "$d" worktree list --porcelain 2>/dev/null; done |
        sed -n 's/^worktree //p' | sort -u
    )
  done <<<"$removals"
fi
exit 0
