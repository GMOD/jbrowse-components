---
name: the-graph-plugins-25-tsc-errors-and-three-unpushed-commits
description: the errors are why the commits are unpublished — betabuild gates on typecheck, so fixing the two adapters' config type is what ships the launch fix
metadata:
  area: graph plugin, out of tree
  category: ready
---

# The graph plugin's 25 tsc errors, and its three unpushed commits

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
`RgfaTabixAdapter` / `MinigraphBubbleAdapter`, and the `GetSubgraph` RPC method.
See [reference/PANGENOME_GRAPHS.md](../reference/PANGENOME_GRAPHS.md) and
[reference/REGION_VIEW_LAUNCH.md](../reference/REGION_VIEW_LAUNCH.md).

Nothing in this repo's `typecheck` sees any of it. The plugin's
`node_modules/@jbrowse/*` are symlinks into this checkout, so it typechecks
against our working source rather than a published tarball — a change here
reaches it immediately, and the reverse is never true. **The error count is
therefore not a property of the plugin; it tracks main.** Re-read it before
quoting it.

## The errors are why the commits are unpublished

`scripts/betabuild.sh` runs `pnpm lint`, `pnpm typecheck` and `pnpm test` before
it will build, and its own comment says the typecheck gate is not optional. So
the gate being red is not a tidiness problem beside the deploy — it *is* the
deploy blocker, and the two halves of this entry are one thing.

Checked 2026-08-26 against jbrowse-components `54ee878bf3`:

- `pnpm typecheck` reports **25 errors, 24 of them under `src/`**, which is the
  set the gate fails on: 7 `GraphGenomeView/model.ts`, 4 each
  `RgfaTabixAdapter.ts` and `MinigraphBubbleAdapter.ts`, 2 `GetSubgraph.ts`, one
  each in `index.ts`, both adapters' `index.ts` and `configSchema.ts`,
  `GraphGenomeView/index.ts` and `components/GraphCanvas.tsx`.
- The hosted bundle and the local `dist/` are **byte-identical** —
  `4bcef24fbaa7cc913a37b1516dbd6551`, 35,316 bytes — and that `dist/` is dated
  2026-08-14 12:26, the same minute as `09df506`, whose subject is literally
  "so betabuild's typecheck gate passes". That commit got the gate green once,
  built, and deployed. Nothing has been published since.
- `76c3904` (2026-08-25) therefore is not in what jbrowse.org serves.

**Start with the two adapters' `config` type.** Most of the plugin's own errors
are one root cause repeated: an adapter types `config` as its
`ConfigurationSchemaType<…>` where `BaseFeatureDataAdapter` wants the *instance*
type (`ModelInstanceTypeProps<Record<string, any>> & { setSubschema, setSlot } &
IStateTreeNode`), so `this` will not pass as its own adapter. Fixing those two
declarations clears the TS2344 pair and the four TS2345 `this` errors directly,
and the adapters' `index.ts` / `configSchema.ts` pairs fall out with them —
about half of the 24.

**The one error outside `src/` is not ours to fix here, and the gate ignores
it.** `packages/core/src/rpc/RpcRegistry.ts:311` — TS2344,
`Type 'EntriesDeclaringCallLevelFields' does not satisfy the constraint 'never'`.
This is the shape `orphan-rpc-augmentation-passes-alone` describes: the plugin's
`GetSubgraph` RPC method augments the registry without declaring its call-level
fields, and only a build that includes both projects sees it. The fix is the
plugin declaring them. A second one that *was* ours —
`packages/render-core/src/hal/mockHal.ts`, TS6133 on an unused `binding` — is
fixed in `e42a26e693`; it needed `noUnusedParameters`, which the plugin sets and
this repo does not, so no in-tree check could ever have raised it.

## What the reader loses meanwhile

Three unpushed commits, HEAD `76c3904`:

```
76c3904 fix(launch): "Open in <assembly>" scrolls a synteny row the graph was launched from
09df506 build: match core's @jbrowse/mobx-state-tree, so betabuild's typecheck gate passes
3ea526b fix(graph): a row layout's deletion bow is capped, so a big one stops enclosing the drawing
```

`76c3904` is the row-aware `connectedViewId` fix `linearViewTarget` needs to
walk nested `views[]`. Until the gate goes green and `betabuild.sh` republishes,
**Open in K12** from a graph node adds a pane rather than scrolling the synteny
row the graph was launched from — the last step of the round trip
`pangenome_ecoli.md` describes, and the only part of that page a reader cannot
perform. `synteny/ecoli_roundtrip` stops one beat short of it deliberately.

Deploy notes, including why the CloudFront invalidation and the served-bytes
comparison are in the script, are in `betabuild.sh`'s own header. Never
`aws s3 cp` by hand.
