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
# More than a test file or two goes to a remote runner where one is installed:
# an agent's multi-suite jest here competes with every other session on the
# box, and ran ~3x slower than the same selection on the runner at a moderate
# load (2026-11-02: 52s vs 17s for ~190 suites). Only where `jb-test` exists,
# since this hook is in the repo and the runner is one machine's. Named test
# files, snapshot updates (whose writes must land here), --listTests and
# anything sent over ssh pass; JB_LOCAL_TESTS=1 is the way through when the
# runner is unreachable.
jest_call="${start}${wrapper}((pnpm[[:space:]]+(run[[:space:]]+)?(test|test-related))|((npx|pnpm exec)[[:space:]]+jest)|([^[:space:]]*node_modules/\.bin/jest))([[:space:]]|$)"
if command -v jb-test >/dev/null &&
  ! grep -Eq '\bssh\b|JB_LOCAL_TESTS=1|(^|[[:space:]])(-u|--updateSnapshot|--listTests)\b' <<<"$cmd" &&
  grep -Eq "$jest_call" <<<"$cmd"; then
  invocation=$(grep -oE "${jest_call}[^;&|]*" <<<"$cmd" | head -1)
  multi=$(grep -q 'test-related' <<<"$invocation" && echo yes)
  if [ -z "$multi" ]; then
    # only words that exist as paths: a -t name or a flag's value is neither
    named=0
    while IFS= read -r w; do
      case $w in /*) p=$w ;; *) p=${cwd:-.}/$w ;; esac
      [ -n "$w" ] && [ -e "$p" ] || continue
      named=$((named + 1))
      if [ -d "$p" ] || ! grep -qE '\.test\.[cm]?[jt]sx?$' <<<"$w"; then
        multi=yes
      fi
    done < <(sed -E 's/.*(test|jest)([[:space:]]|$)//' <<<"$invocation" | tr -d "\"'" | tr -s '[:space:]' '\n')
    [ "$named" -eq 0 ] && multi=yes
  fi
  if [ -n "$multi" ]; then
    refuse 'Refused: a multi-suite jest run on the laptop. `jb-test` runs the suites this branch changed on ada (`jb-test -- <jest flags>`, `jb-test --all`), queued so parallel agents cannot overrun it. Name test files to run them here; JB_LOCAL_TESTS=1 when ada is unreachable.'
  fi
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
