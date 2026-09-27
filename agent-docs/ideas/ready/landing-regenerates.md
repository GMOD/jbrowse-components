---
name: landing-regenerates
description: Colin answered on 2026-09-25 that landing a branch regenerates the generated artifacts, once per branch on the land path, not in pre-commit. .githooks/post-merge is the seam but runs autogen --check read-only because the primary checkout is shared, so the regenerate belongs in the lander's worktree before merge --ff-only, with post-merge only verifying.
---

# Landing regenerates

Standalone `pnpm autogen` commits were 26 of the last 200 on 2026-09-25 and
about 27 of the last 300 on 2026-09-26. Main sits red on stale generated
artifacts meanwhile, and the pre-commit hook names the commit where staleness
was last re-checked rather than the one that caused it, so every agent that
commits pays the attribution cost first.

**Colin's answer, 2026-09-25: regenerate on the land path.** A branch
fast-forwards into main once, so it is one run per branch. Not the pre-commit
hook: that measured about 60 s wall clock, and several generators compile the
live tree.

`.githooks/post-merge` runs `pnpm autogen --check` among its gates and writes
nothing, on purpose: the primary checkout is shared, and a fixer there can
clobber another agent's uncommitted files. So the regenerate runs in the
lander's worktree after the rebase onto main and before `merge --ff-only`,
committing its output on the branch, and post-merge stays the check that it
happened.
