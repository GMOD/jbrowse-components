---
name: agent-memory-retirement
description: State of the move from the out-of-repo agent memory store into repo docs, and of the switch to a worktree-per-agent git workflow. What landed, what is left in the store and why, the measurements not to re-derive, and the one loose end in the committed reference index. Read before writing a new memory, or before wondering why the git rules changed.
---

# Retiring the agent memory store, and the worktree switch

**State as of 2026-08-10.** Two threads, both mostly landed.

## What the store was, and where it went

Agent memory lived per-project under three separate Claude profile directories
(`~/.claude`, `~/.claude2`, `~/.claude3`), each with its own naming convention
and its own index, none readable from the other two. For this repo that was
**805 files** across the three.

They are now one shared store at `~/.claude-memory/<project-slug>/`, symlinked
into all three profiles (`~/.claude-memory/bin/link-memory` relinks, and adopts
a new project on demand). Everything durable moved into the repo:

- `reference/REJECTED_IDEAS.md` — ideas measured and declined, one bullet each.
- `reference/HOSTING.md` — bucket, CDN, figure store, hosted assets, publishing.
- `reference/DEMO_DATASETS.md` — the data behind figures and tutorials.
- `reference/PERF_INSTRUMENTATION.md` — gained the contended-box measuring rule.
- `website/CLAUDE.md` — three screenshot traps that had no home.

This repo's store is down to **5 files**, all genuinely in-flight. Everything
else was deleted, recoverable from `~/claude-memory-backup-2026-08-10.tar.gz`
(all 1171 originals, the only copy of the ~800 deletions).

## The rubric, so the next pass doesn't re-argue it

Keep only what re-reading the repo cannot recover. Concretely:

- **Delete** anything describing where code lives or how it works. It is
  rediscoverable, and it rots into being confidently wrong.
- **Delete** completed work and "DONE" notes — git holds them.
- **File** a measured negative result (`REJECTED_IDEAS.md`), a hosting or
  dataset fact (`HOSTING.md`, `DEMO_DATASETS.md`), or a decision heavy enough to
  need an ADR.
- **Keep as memory** only uncommitted, in-flight state, and delete it when the
  thread lands.

Preferences were curated down from 131 to ~55 and then dropped entirely as not
worth their standing context. Two of them were arguably worth keeping and are
recorded here rather than lost: a pathspec commit silently skips *new* files, and
`--amend`/`rebase`/`reset` race other agents in the shared checkout. Both are now
in `~/.claude/CLAUDE.md` under the shared-checkout rules.

## What is still in the store, and why it wasn't filed

Five entries, all uncommitted or blocked work rather than knowledge:

- `rgfa-multirank-allele-placement` — half-fixed, uncommitted.
- `project_synteny_clicked_outline_tiled_mode` — blocked on a visual call.
- `project-pansn-prefix-discovery-gap` — adapters now throw naming the prefixes,
  but the add-track path still can't discover them.
- `screenshot-review-bad-items` — an open review loop with per-item status.
- `graph-plugin-canvas2d-port` — WIP in a sibling checkout.

Each should end as a commit or as a line in `TODO.md`, not as a doc.

## Don't re-derive these

- **`git -C <primary> merge --ff-only <branch>` is safe against a dirty primary
  checkout.** Tested both directions in a scratch repo: it fast-forwards past
  unrelated modified files, and on a collision it refuses and leaves the local
  edit intact. The failure mode is a refusal, never a clobber.
- **`git push . HEAD:main` does not work here** — `receive.denyCurrentBranch` is
  unset, so it refuses. `git update-ref` on a checked-out dirty `main` is worse:
  it desynchronises index and worktree. The ff-only merge is the only sanctioned
  landing move.
- **The primary checkout carried ~126 dirty files** from other agents when this
  was written. That is the real constraint on continuous landing: a branch
  touching any of those paths gets refused. The workflow gets easier as the
  backlog drains, and it is not frictionless before then.
- **`pnpm autogen --check` reports `config/model/api docs` stale** from another
  agent's uncommitted source changes (`LinearGenomeView.md`,
  `LinearSyntenyViewHelper.md`). Running full `pnpm autogen` sweeps their
  regeneration into your diff — run the single generator you need instead, e.g.
  `node website/scripts/generate-reference-index.ts`.

## Loose end

`reference/README.md` was regenerated and committed while
`reference/SHADER_LIFT_INVENTORY.md` was still untracked, so **the committed
index carries a row for a file that is not in the repo**. It resolves the moment
that doc's author commits it. If that thread is abandoned instead, regenerate the
index to drop the row. Nothing else in the index dangles.

## Next steps

1. Land or file the five in-flight entries above; the store should reach zero.
2. Drain the primary checkout's dirty files so `--ff-only` landing stops being
   refused.
3. The other 44 repos still hold ~235 memories under the same three profiles,
   now shared but not yet cut. Same rubric applies; most of those repos have no
   `agent-docs/`, so their durable content belongs in a `CLAUDE.md`.
4. Delete this handoff when 1 and 2 are done — its durable half is already in
   `reference/`.
