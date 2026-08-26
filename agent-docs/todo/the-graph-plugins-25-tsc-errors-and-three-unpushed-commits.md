---
name: the-graph-plugins-25-tsc-errors-and-three-unpushed-commits
description: the gate is green as of 2026-08-26 and four commits are unpublished; what is left is the deploy decision, not the errors
metadata:
  area: graph plugin, out of tree
  category: ready
---

# The graph plugin's tsc errors, and its unpushed commits

## Which plugin, and why it is spelled two ways

One plugin, two spellings, and the split is checkout versus published artifact:

| what | spelling |
| --- | --- |
| local checkout | `~/src/jb2plugins/jbrowse-plugin-graphgenomeview` |
| `package.json` `name`, built bundle, GitHub repo, hosted prefix | `jbrowse-plugin-graphgenomeview**er**` |
| test config in this repo | `test_data/graphgenomeview/` |

So `demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js` and
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview` are the same thing. It is the
GraphGenomeView plugin — the Bandage-style pangenome graph view, its
`RgfaTabixAdapter` / `MinigraphBubbleAdapter`, and the `GetSubgraph` and
`GraphComputeLayout` RPC methods. See
[reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) and
[reference/REGION_VIEW_LAUNCH.md](../reference/REGION_VIEW_LAUNCH.md).

## The errors are fixed; the deploy is what is left

`f1393b4` in the plugin repo takes `pnpm typecheck` from 25 errors to 0, and
lint and tests pass beside it — so all three gates `betabuild.sh` runs are
green. **What remains is the decision to publish, which is not a code change.**
`betabuild.sh` uploads to S3 and invalidates CloudFront, and the hosted bundle
is a live change to every config naming it; read its header before running it.

Four commits are unpublished, HEAD `f1393b4`:

```
f1393b4 fix(build): green the typecheck gate — a duplicate mobx-state-tree, and two RPC contracts
76c3904 fix(launch): "Open in <assembly>" scrolls a synteny row the graph was launched from
09df506 build: match core's @jbrowse/mobx-state-tree, so betabuild's typecheck gate passes
3ea526b fix(graph): a row layout's deletion bow is capped, so a big one stops enclosing the drawing
```

`76c3904` is the row-aware `connectedViewId` fix `linearViewTarget` needs to
walk nested `views[]`. Until it is published, **Open in K12** from a graph node
adds a pane rather than scrolling the synteny row the graph was launched from —
the last step of the round trip `pangenome_ecoli.md` describes, and the only
part of that page a reader cannot perform. `synteny/ecoli_roundtrip` stops one
beat short of it deliberately.

## What the 25 turned out to be, since the guess here was wrong

**This entry used to say "start with the two adapters' `config` type" and that
was the wrong diagnosis.** Both adapters already declare `config` as
`Instance<typeof Schema>`, which is the in-tree pattern; no adapter code needed
changing at all. They looked wrong because of what follows.

- **16 of the 25 were one duplicate package.** `@jbrowse/core` is symlinked into
  this checkout, so it carries THIS tree's `@jbrowse/mobx-state-tree` while the
  plugin resolved its own copy — and mst's types do not survive the trip between
  two copies, so every structural check across the boundary failed and none of
  the errors named the cause. `09df506` fixed this once by matching core's
  version; core moved and the pin went stale again. **Matching the version is not
  enough on its own** — `mobx` has to match too (7.0.0 → 7.0.3), because that is
  what makes both resolve to the same peer-suffixed path.
- **Both RPC methods declared call-level fields.** `sessionId` on both,
  `statusCallback` on `GraphComputeLayout`. Core's
  `EntriesDeclaringCallLevelFields` fails the build for those, and it is the
  error that showed up *inside this repo* at `RpcRegistry.ts:311` — the shape
  `orphan-rpc-augmentation-passes-alone` describes. Both classes were also left
  at the default `MethodName = string`, which resolves `RpcExecuteArgs` to
  `unknown`, so `execute` was checked against nothing.
- Three smaller drifts: `execute` takes one argument now, a `StatusCallback`
  takes an `RpcStatus` rather than a string, and `attachRenderingBackend`'s
  second argument is a setup thunk whose `upload` returns a boolean.

**The count tracks main, so re-read it rather than quoting it.** The plugin
typechecks against our working source; every one of these was drift from this
repo reaching an out-of-tree consumer, and nothing here sees it.

Three tests failed for a separate reason worth keeping: `33c15386b3`
(2026-08-17) taught the LGV to call `getRegionForRefName`, and the plugin's
hand-written assembly stub had no such method. A stub is the other thing a core
change silently breaks out of tree.
