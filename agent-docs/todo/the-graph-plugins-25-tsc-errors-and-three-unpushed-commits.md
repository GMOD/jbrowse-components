---
name: the-graph-plugins-25-tsc-errors-and-three-unpushed-commits
description: fix the two adapters' config type first — one root cause is most of the 25
metadata:
  area: graph plugin, out of tree
  category: ready
---

# The graph plugin's 25 tsc errors, and its three unpushed commits

The plugin lives outside this repo, at
`~/src/jb2plugins/jbrowse-plugin-graphgenomeview`, which is why nothing in this
repo's `typecheck` sees any of this. Its `node_modules/@jbrowse/*` are symlinks
into this checkout, so it typechecks against our working source rather than a
published tarball — a change here reaches it immediately, and the reverse is
never true.

`npx tsc --noEmit` there (typescript 7.0.2) gives **25 errors** as of
2026-08-25: 7 in `src/GraphGenomeView/model.ts`, 4 each in `RgfaTabixAdapter.ts`
and `MinigraphBubbleAdapter.ts`, 2 in `GetSubgraph.ts`, one each in six more
files, and one inside jbrowse-components.

**Start with the two adapters' `config` type.** Most of the plugin's own errors
are one root cause repeated: an adapter types `config` as its
`ConfigurationSchemaType<…>` where `BaseFeatureDataAdapter` wants the *instance*
type, so `this` will not pass as its own adapter. Fixing those two declarations
is likely to clear a dozen of the 25 — the TS2345 and TS2322 pairs, which are 14
of them between them.

**The one error in this repo is not ours to fix here.**
`packages/core/src/rpc/RpcRegistry.ts:311` — TS2344,
`Type 'EntriesDeclaringCallLevelFields' does not satisfy the constraint 'never'`.
This is the shape `orphan-rpc-augmentation-passes-alone` describes: the plugin's
`GetSubgraph` RPC method augments the registry without declaring its call-level
fields, and only a build that includes both projects sees it. The fix is the
plugin declaring them. A second one that *was* ours —
`packages/render-core/src/hal/mockHal.ts`, TS6133 on an unused `binding` — is
fixed in `e42a26e693`; it needed `noUnusedParameters`, which the plugin sets and
this repo does not, so no in-tree check could ever have raised it.

## Three unpushed commits, HEAD `76c3904`

```
76c3904 fix(launch): "Open in <assembly>" scrolls a synteny row the graph was launched from
09df506 build: match core's @jbrowse/mobx-state-tree, so betabuild's typecheck gate passes
3ea526b fix(graph): a row layout's deletion bow is capped, so a big one stops enclosing the drawing
```

`76c3904` is the row-aware `connectedViewId` fix `linearViewTarget` needs to
walk nested `views[]`. Until `betabuild.sh` republishes the hosted bundle at
`demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js`, **Open in
K12** from a graph node adds a pane rather than scrolling the synteny row the
graph was launched from — which is the last step of the round trip
`pangenome_ecoli.md` describes, and the only part of that page the reader cannot
perform. `synteny/ecoli_roundtrip` stops one beat short of it deliberately.
