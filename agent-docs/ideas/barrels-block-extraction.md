---
name: barrels-block-extraction
description: A 169-line module with one runtime import pulls a 17,104-line closure because it imports through a barrel, and `render-core` sits in the same repo with 32 subpath exports and no `.` proving the alternative. The measurement, the two files that hold every leaf hostage, and why this is an extraction blocker rather than a bundle-size claim.
---

# Barrels are what block extraction

`@jbrowse/render-core` left `@jbrowse/core` successfully and is a real leaf —
`mobx` plus `@jbrowse/mobx-state-tree`, React as a peer. The per-region fetch
harness did not leave, and reads as hopelessly coupled to the application. The
difference is not architecture. It is that render-core publishes 32 subpath
exports and **no `.` entry**, and `@jbrowse/core/util` is one barrel.

That makes this a rare thing to write up: a controlled comparison between the
two shapes inside a single codebase, with the same authors and the same period.
Audience and framing: [upstreamable-ideas](upstreamable-ideas.md).

## The measurement

`fetchEachRegion.ts` is 169 lines with exactly one runtime import:

```ts
import { createStatusFanOut } from '@jbrowse/core/util'
```

Its runtime closure is **114 files and 17,104 lines**. `createStatusFanOut`
lives in `util/progress.ts`, itself a 6-file, 1,223-line, zero-dependency leaf.
Everything between those two numbers is `util/index.ts`: 536 lines, 68 value
re-export statements.

The same edge accounts for the rest of the harness — `FetchMixin.ts` 116 files,
`installPerRegionFetchAutoruns.ts` 118 files — and every one of them imports the
same barrel. In the same tree, `MultiRegionDisplayMixin.ts` imports
`@jbrowse/render-core` three times by deep path
(`/installPerRegionLifecycle`, `/renderBlock`, `/RenderLifecycleMixin`) and pays
nothing.

`planRegionFetch.ts` is the control: 278 lines, zero imports, closure of one.

## The type side has its own barrel, and it is worse

`util/types/index.ts` is 869 lines and exports 45 interfaces. Thirty of them are
`AbstractSessionModel` and its family — `SessionWithDrawerWidgets`,
`SessionWithConnectionEditing`, `AppRootModel`. The other fifteen are plain
data: `Region`, `NoAssemblyRegion`, `AugmentedRegion`, the four `Location`
shapes and their `Pre*` variants, and plugin metadata.

`bpUtils.ts` imports one thing from that file — `import type { Region }` — and
so `locString.ts` has a runtime closure of 4 files / 661 lines and a **type
closure of 410 files / 47,938 lines**, reaching `PluginManager`, `CorePlugin`
and every widget. `assemblyConfigUtils.ts` is the same and worse, reaching the
barrel at runtime.

So a 300-line coordinate utility cannot leave the package because the plain-data
type it needs shares a file with the application's session interface. That is
the same split [lightweight-toolkit.md](lightweight-toolkit.md) wants for
`AbstractSessionModel`, arrived at from the opposite direction, and two
independent arguments for one move should raise its priority there.

## The work

1. **Give `packages/core/src/util` a subpath export map**, mirroring
   render-core's. This is what converts the fetch harness toward leaf shape and
   drops `locString`, `bpUtils` and the rest out as a by-product.
2. **Split `util/types/index.ts` 30/15** — the session family stays, the fifteen
   plain-data types move to a file nothing app-shaped imports. `Region` is
   `SnapshotIn` of an MST model in `./mst.ts`, so the plain-data half still
   carries an `@jbrowse/mobx-state-tree` dependency unless it is redeclared
   structurally.
3. Then the extractions in
   [lightweight-toolkit.md](lightweight-toolkit.md) stop needing an argument.

## What this is not

**Not a bundle-size claim.** Bundlers tree-shake that barrel, so 17,104 lines is
a module-graph figure and says nothing about shipped bytes.
[EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md) owns that axis and the two are
easy to quote for each other. The cost here is that a module importing through a
barrel cannot be moved into a package without dragging the barrel's whole graph
with it, which is true regardless of what any bundler does afterwards.

**Unverified:** nothing in `packages/core` or `packages/render-core` imports
back from `BaseLinearDisplay`, so the direction is clean — but nobody has tried
to build the harness as a separate package, and no cycle is necessary rather
than sufficient.
