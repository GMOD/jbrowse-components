---
name: bump-the-graph-figure-configs-off-the-old-plugin-pin
description: the plugin shipped 2026-08-26 and readers get it, but the four graph test configs still pin the 2026-08-14 bundle — bumping them is a figure re-render, because one of the four fixes is visual
metadata:
  area: graph plugin, figures
  category: ready
---

# Bump the graph figure configs off the old plugin pin

The GraphGenomeView plugin — `~/src/jb2plugins/jbrowse-plugin-graphgenomeview`
locally, `jbrowse-plugin-graphgenomeview**er**` as a package, bundle, GitHub repo
and hosted prefix — was published on 2026-08-26 as version **`8f9efd68f339`**,
after four months' worth of unpublished commits and a typecheck gate that had
been red since the previous build.

**Readers already have it.** Every docs config block names the *unversioned*
entry point, so `graph_genome_view.md`, `pangenome_ecoli.md`,
`pangenome_hprc.md` and `pangenome_cactus.md` all serve `8f9efd68f339` now. That
closes the gap this entry used to be about: **Open in K12** from a graph node
scrolls the synteny row the graph was launched from, which is the last step of
`pangenome_ecoli.md`'s round trip and used to be the only thing on that page a
reader could not perform.

**The figures do not, deliberately.** `test_data/graphgenomeview/`'s four
configs — `config.json`, `hprc.json`, `hprc_tour.json`, `ecoli_pangenome.json` —
pin `4bcef24fbaa7`, the immutable copy of the 2026-08-14 build, and
`betabuild.sh` never rewrites a content-addressed prefix. So the committed graph
figures still resolve to exactly the bundle they were captured against, and the
deploy changed none of them. That is the pin doing its job, and it is why
`betabuild.sh` writes one.

## What is left, and why it is not a one-line edit

Bumping those four `esmUrl`s to `8f9efd68f339` **is a figure re-render**, because
one of the four published fixes is visual: `3ea526b` caps a row layout's deletion
bow at three rows, so a big one stops enclosing the drawing. It was written
against a review of `pangenome/hprc_cfhr_deletion` — "the dashed lines frankly
look weird for the 'deletion'" — where the 84.7 kb CFHR3/CFHR1 arc bowed 148 px
and landed 5.5 rows into the rank rows while its 28.6 kb and 11.2 kb neighbours
read correctly. So the bump is what makes that figure better, and the figure has
to be re-shot to show it.

In order:

- Bump the four `esmUrl` pins to `8f9efd68f339`.
- Re-render the row-layout graph figures and review them. `hprc_cfhr_deletion`
  is the one the fix was for; the isotropic layouts are deliberately NOT capped,
  so a force-directed figure should come back byte-identical and is the control.
- `pnpm figures:push --filter`, commit `figures.lock`.

**Do not bump the pins without re-rendering.** A pinned config is what keeps a
figure reproducible, so moving the pin while leaving the PNG is the drift the
pin exists to prevent — in the direction nothing checks, since `figures.lock`
hashes bytes in S3 rather than whether the picture still matches the plugin.

## What the 25 errors turned out to be, since the guess was wrong

Kept because it will recur on the next core bump. The entry used to say "start
with the two adapters' `config` type"; both adapters already declared
`Instance<typeof Schema>`, the in-tree pattern, and no adapter code changed.

- **16 of the 25 were one duplicate package.** `@jbrowse/core` is symlinked into
  this checkout, so it carries THIS tree's `@jbrowse/mobx-state-tree` while the
  plugin resolved its own — and mst's types do not survive the trip between two
  copies, so every structural check across the boundary failed with nothing
  naming the cause. **Matching the mst version is not enough on its own**:
  `mobx` has to match too (7.0.0 → 7.0.3), because that is what puts both on the
  same peer-suffixed path. `09df506` fixed this once by version alone and it went
  stale the next time core moved.
- **Both RPC methods declared call-level fields** — `sessionId` on both,
  `statusCallback` on `GraphComputeLayout`. That is the error that showed up
  *inside this repo* at `RpcRegistry.ts:311`, the shape
  `orphan-rpc-augmentation-passes-alone` describes. Both were also left at the
  default `MethodName = string`, which resolves `RpcExecuteArgs` to `unknown`, so
  `execute` was checked against nothing.
- Three smaller drifts: a one-argument `execute`, a `StatusCallback` taking an
  `RpcStatus` rather than a string, and `attachRenderingBackend`'s second
  argument becoming a setup thunk whose `upload` returns a boolean.
- Three tests failed for a separate reason: `33c15386b3` (2026-08-17) taught the
  LGV to call `getRegionForRefName`, and the plugin's hand-written assembly stub
  had no such method. A stub is the other thing a core change breaks out of tree
  in silence.

The count tracks main rather than the plugin, so re-read it rather than quoting
it.
