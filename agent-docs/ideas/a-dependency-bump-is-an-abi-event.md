---
name: a-dependency-bump-is-an-abi-event
description: Moving the `@jbrowse/mobx-state-tree` or `@mui/material` range broke an out-of-tree plugin worse than every renamed export combined — ~500 errors, none naming their cause — because a module augmentation cannot reach a second copy of the module it augments. Nothing in the tree sees this, and the fix is a decision about which packages cross the boundary at all.
---

# A dependency bump is an ABI event, and no checker sees it

`reference/PLUGIN_ABI_STABILITY.md` §"Measured: what v5 cost one out-of-tree
plugin" typechecked Apollo against its own pin and against main ~5,200 commits
later. The renamed exports, the moved extension points, the removed component
props — all of it came to **24 errors**, each naming its cause.

With deps *not* aligned it was **~500, and none of them name their cause**:

- `@jbrowse/mobx-state-tree` reports `[$type]` missing from every `types.model`
  argument.
- `@mui/material` reports `startCodon` / `bases` missing from `Palette`.

Neither message mentions duplication. An external author reads them as a broken
plugin, and the largest class by count is the one with no checker behind it.

## Why nothing sees it

The mechanism is that **a module augmentation cannot reach a second copy of the
module it augments.** Our `Palette` augmentation lives in a program holding one
`@mui/material`; the consumer's program holds ours and theirs, and the
augmentation lands on the wrong one.

That is invisible in tree by construction — one install, one copy, one program.
It is invisible to `typecheck`, to `check-declaration-leaks`, and to
`check-extension-point-reachability` for the same reason each of those is
useful: they all run against a tree where the duplication cannot occur.

It is also invisible to the ledger. §"Ledger: behavior changes external plugins
inherit" records renames and removals — the things a human notices doing them.
A range bump does not feel like an ABI change while you are making it.

## The lever is which packages cross the boundary at all

Not every dependency can do this. The ones that can are the ones whose **types
appear in our public surface** or that **we augment**, and that set is small
enough to name: `@jbrowse/mobx-state-tree`, `@mui/material`, `react`, `mobx`,
`mobx-react`. Everything else can be duplicated harmlessly.

So the question is not "how do we check every dependency" — it is "which
dependencies are part of the contract", which is the same question
[the `@public` set](../reference/PLUGIN_ABI_STABILITY.md#the-real-cure-bound-what-external-plugins-can-reach)
asks about exports, one level down. Three directions, and they are not
exclusive:

- **Declare them.** A boundary-crossing package moves to `peerDependencies`, so
  the consumer's install resolves one copy and a mismatch is an install-time
  warning rather than 500 type errors. Costs: peer ranges are a support burden,
  and `@jbrowse/mobx-state-tree` is our own fork, which makes the range ours to
  widen rather than a third party's.
- **Detect them.** A check that reads the emitted `.d.ts` for the set of
  external packages named in the `@public` surface, snapshotted — so *adding*
  a package to the contract is a visible diff, and bumping one already in it
  fails until the ledger gains an entry. This is the same shape as
  `check-declaration-leaks.ts` and its cost is about the same.
- **Reproduce them.** `component_tests/plugin-vite` already installs
  `example-plugins/score-example` from a packed tarball, and is the only CI job
  resolving `@jbrowse/*` through `publishConfig` exports. It is the one place a
  second copy could be *induced* on purpose — pin an older `@mui/material` in
  that fixture and assert the error, so the failure mode has a test rather than
  a paragraph.

## First move

**Name the set, before building anything.** Grep the emitted `.d.ts` for
external package specifiers and see how many distinct packages actually cross —
the guess above is five and has not been measured. If it is five, peers are
tractable and the detector is a snapshot of a five-line list. If it is fifty,
the detector is the only affordable answer and the peer conversation is about a
subset.

That measurement is cheap, and it is the input every direction above needs.

## What this is not

Not a case for pinning. Pinning trades an invisible failure for a stale one, and
`build-and-dependencies.md` has the MUI v10 bump we actively want. The point is
that the bump should *announce itself* — a release note saying "this is an ABI
event" is worth more than the ones about renamed exports, and today nothing
prompts anyone to write it.

Not a duplicate-install nit either. `pnpm dedupe` fixes the case where the
ranges are compatible; this is the case where they are not, and the consumer is
entitled to their own copy.
