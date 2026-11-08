---
name: worktrees
description: How do worktrees, rebasing, landing on the shared local main, pushing and worktree removal work when several agents share one checkout, and which git steps fail silently? Read before landing a branch, resolving a rebase conflict, pushing main or removing a worktree.
audience: internal
kind: operations
---

# Worktrees and landing

Several agents share one primary checkout and its local `main`. Each works in
`.claude/worktrees/<name>`, which `.claude/hooks/setup-worktree.sh` cuts from
local `main` and installs; the branch lands on `main` as a fast-forward. Local
`main` runs ahead of `origin/main` until someone pushes.

The hooks refuse the loud mistakes and explain themselves when they fire:
`refuse-commands.sh` blocks `git stash`, a piped `git merge` and removing a
worktree that holds commits `main` lacks; `.githooks/pre-merge-commit` blocks a
`--no-ff` merge that could have been a fast-forward. What follows is what
nothing refuses. Installs and stale bases: [TOOLCHAIN.md](TOOLCHAIN.md#worktrees).

## A fresh worktree

- **Run one cheap jest file before trusting any gate.** `Cannot find module
  'babel-jest'` means the install failed while tsc, verify and autogen still run
  normally; `~/.claude/worktree-hook.log` says `WARN: pnpm install failed`. Run
  `pnpm install --frozen-lockfile`. If a rebase over a dependency bump leaves it
  missing and every install answers "Already up to date", `rm -rf node_modules`
  and `CI=true pnpm install --frozen-lockfile`.
- **The gitignored corpora are absent:** `website/static/img`,
  `website/static/media`, `products/jbrowse-img/img` and
  `products/jbrowse-web/browser-tests/__snapshots__`. Symlink the primary's
  (`ln -s <primary>/website/static/img website/static/img`) or `pnpm
  figures:pull`. Without them pre-push skips the figure-dependent generators.
- **`pnpm diagrams` dies before the agent-docs half** when `website/static/img`
  is missing, since it renders the website corpus first. `mkdir -p
  website/static/img`, run it, then `git checkout website/diagrams/diagrams.lock`
  and commit only the agent-docs `.dot` and `.svg`.
- **A probe written into the repo goes in your worktree, never the primary.** An
  untracked `website/scripts/tmp-probe-*.ts` there turned another session's
  `pnpm verify` red.

## Capturing figures from a worktree

- **A branch that changes no app source captures against the primary's build**
  with `generate-screenshots.ts --port <n>`, which proxies everything but
  `/test_data/` and serves that from the worktree. The server must answer Range
  (`createTestServer` from `packages/browser-test-utils/src/server.ts` with the
  primary's `jbrowseWebRoot` and `repoRoot`); a `build/` assembled from symlinks
  404s and the run dies with `no census on the page at all`.
- **Check the port is free** (`ss -ltnp | grep <n>`): a proxy to another
  session's server captures their build. `--localport` moves the generator's own
  server off 3334.
- **A `products/jbrowse-web/build` made in a worktree goes with it**, so landing
  and removing it leaves the primary's build as stale as it was.
- **Publish from the worktree root** with `node website/scripts/figures.ts push
  --exact --filter a,b`: it rewrites only your lines of the root
  `figures.lock`. Never `figures.ts pull --force` in the primary; it discards
  other sessions' unpublished figures.

## Working beside other sessions

- **Claim a handoff item before building it.** Nothing marks one taken, and two
  sessions once built the same two calls. `git fetch` and re-read the handoff on
  `origin/main`, check `git worktree list` for a worktree named for the item and
  `git log --since='3 hours'` for commits on its files, and land the handoff's
  shrink with the first commit of the work.
- **Commit by path in any shared tree** (`git commit --only -- <paths>`), never
  `git add -A`: the index holds other sessions' staged renames and probes. A
  hook's "Finished on N files" larger than yours is the tell.
- **Use `git add -A <paths>` when a listed path may already be deleted.** One
  bad pathspec stages nothing, and the commit records only what was staged
  before. Read `git status --short` between staging and committing.

## Rebasing and conflicts

- **Rebase onto local `main`, never `origin/main`** while `origin/main..main` is
  non-empty, or the branch cannot fast-forward. Repair a wrong one with `git
  rebase --onto main <last replayed main commit>`.
- **Read `git reflog -3 main` before rebasing a waiting branch.** If another
  session reset `main` onto a rebased copy (`reset: moving to …`), a plain
  rebase replays their commits; use `git rebase --onto main <old-main-tip>`.
- **`git reset --soft main` to squash WIP stages a revert** of whatever landed on
  `main` since you rebased; files you never touched in `git status` are the
  tell. Reset to the sha you branched from (reflog's `rebase (start)` entry),
  commit, then rebase.
- **`--theirs` is safe only for generated files.** Taken for a `.slang` it
  reverts the shader work that landed on `main` with no marker left, and `pnpm
  gen:shaders` regenerates the reverted source cleanly; `pnpm typecheck` caught
  it. Script the sweep to match `\.generated\.(ts|json)$` and abort on anything
  else.
- **`scripts/registryBundleSizes.json` conflicts on most rebases.** Take
  `main`'s copy; autogen at pre-push remeasures it (`pnpm
  measure-registry-bundle` does it in seconds).
- **A clean rebase can still lose work.** A duck-typed field mirroring a symbol
  `main` deleted raises neither a conflict nor a tsc error, and a whole-file
  `git apply -3` of a branch's diff over a test file `main` refilled kept only
  the branch's tests. Grep the symbols your diff adds against the rebased tree,
  read `git log --oneline <branch>..main`, and compare per-file test counts
  (`git show main:<f> | grep -cE "^\s*(test|it)\("`).

## Landing

- **Land one branch at a time**: rebase onto local `main`, `pnpm typecheck`,
  land, remove. Landing overlapping shader branches one after another still
  needs a `pnpm typecheck` on `main` after the last.
- **Send the merge alone and read its result before any cleanup.** `main` moves
  between calls, so `--ff-only` refuses often, and every lost worktree came from
  a removal that ran past a refused merge. A refusal means not landed: check
  `git log main` for the branch tip, rebase, retry.
- **Check the primary's branch with `git status -sb` first.** HEAD there can be
  another agent's fresh branch at `main`'s tip, so `merge --ff-only` lands on
  their branch. When it is not `main`, `git -C <primary> fetch -q . <branch>:main`
  moves `main` as a fast-forward (and refuses while `main` is checked out
  anywhere); post-merge does not run for it.
- **Re-read `git log -1 main` right before landing.** An agent can commit on
  `main` and reset it away; a rebase in that window makes the commit your
  ancestor and your landing restores it.
- **Never edit, `--amend`, `rebase` or `reset --hard` in the primary.** Any
  session's push runs pre-push, which commits whatever its fixers touched as
  `chore: pre-push autofix`, so a file edited there briefly reaches `origin`.
  Run full suites in your worktree; one in the primary spans other landings.
- **Landing is publishing.** Any session's `git push origin main` carries every
  commit on local `main`, so finish verification first. Before a push, read
  `git log origin/main..main`; the pusher owns the red it carries.

## Pushing

- **Push from your clean worktree** (`git push origin HEAD:main`, or `git push
  origin main` after landing). In a checkout with tracked edits open, even
  another session's, pre-push puts autogen's rewrites back to HEAD and blocks a
  push to `main`.
- **When local `main` has diverged from `origin`**, branch from `origin/main`,
  cherry-pick only your commits and push `HEAD:main`; the owners' later rebases
  skip your copies by patch id. Rebasing onto `origin/main` instead carries
  others' commits and their red.
- **A long pre-push drops the GitHub SSH connection** ("Connection to github.com
  closed by remote host", exit 141, nothing pushed), since git connects before
  the hook runs. Push with `GIT_SSH_COMMAND="ssh -o ServerAliveInterval=20 -o
  ServerAliveCountMax=60"`.
- **A "rejected" push can have landed**: `cannot lock ref 'refs/heads/main'`
  after the hook pushed its own autofix commit. Compare `git ls-remote origin
  refs/heads/main` with `git rev-parse main` before retrying.

## Moving a swept-in file between commits

Without `rebase -i`, rebuild the later commit from its own tree so nothing
conflicts:

```sh
git branch backup-x HEAD
git checkout --detach <earlier>
git checkout <earlier>^ -- <swept-in paths>
git commit --amend --no-edit --no-verify
git checkout <later> -- .
git commit -C <later> --no-verify
git rebase --onto HEAD <later> <branch>
```

`git diff --stat backup-x HEAD` must print nothing: the final content is
unchanged and only attribution moved, so no gate needs re-running.

## Removing a worktree

Removal is a human call. `pnpm worktree-triage` classifies each worktree and
explains its columns (`--branches` adds recent branches with no worktree);
re-derive it rather than trusting a written list.

- **Landed, clean and hours cold, all three.** One landed, clean worktree had
  been cut a minute earlier by a live agent.
- **`dirty` may be only symlinks** (`?? node_modules`, `?? products/*/build`);
  check `git status --short`.
- **Read a dirty worktree's uncommitted diff against its commits** before landing
  the committed half: the uncommitted work can replace the design the commits
  hold.
- **`git worktree remove` takes the gitignored files with it**, browser-test
  goldens in `__snapshots__` included, and nothing downstream notices a lost
  golden. Push them (`pnpm --filter @jbrowse/web snapshots push --filter
  <name>`) or copy them out first.
- **Kill a capture's leftover Chrome or Xvfb by PID** (`ls -l /proc/[0-9]*/cwd
  | grep <wt>`), not by name.
- **Landing does not need the branch's own worktree**: `git worktree add <tmp>
  <branch>`, install, rebase, test, land from the primary.
- **`git branch -d` refuses a rebased branch that was ever pushed.** That is no
  reason for `-D`; leave it and decide the origin branch. There, `git cherry`
  is the screen: confirm a `-` by finding the commit on `main` with the same
  `git patch-id --stable`, and treat a `+` whose files `git merge-tree` reports
  as add/add conflicts as already on `main`. Merged into local `main` is not on
  `origin`, so deleting the remote branch can leave no remote copy.

## A worktree directory can vanish

Another session can remove a worktree directory mid-task. The commits survive on
the branch (`git log <branch>`); `git worktree prune` and `git worktree add
<path> <branch>` recover it.

- **Git does not error, it retargets.** The cwd survives as an unregistered
  directory inside the primary's tree, so every later `git` call answers for the
  primary and `main`: `../../../` prefixes in `git status`, commits you never
  made in `git log`.
- **Before a mutating git command, `git rev-parse --git-dir` must end in
  `.git/worktrees/<name>`.** A bare `.git` there means the commit lands on
  `main`.
- **`git -C` into a directory with no `.git` answers for the primary** too. Such
  an orphan holds only gitignored build output, so `rm -rf` is right.
