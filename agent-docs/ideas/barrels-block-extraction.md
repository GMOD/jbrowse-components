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

Figures as first taken. `scripts/moduleClosure.ts` reproduces them, and the
current ones are in the status section at the bottom.

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

## Done, 2026-08-23: both edges cut, the extraction still unproven

Steps 1 and 2 landed. The plain-data types are `util/types/data.ts` and
`types/index.ts` re-exports them; the fetch harness and the `util/` leaves
import by subpath; `getRpcSessionId` moved from `util/tracks.ts` (which reaches
the configuration schemas) to `util/mstUtils.ts`, which is what let
`fetchContext.ts` stop dragging them.

`scripts/moduleClosure.ts` is how the numbers above and below were taken —
TypeScript's own resolver over the static import graph, runtime edges for one
column and every edge for the other. `scripts/moduleClosure.test.ts` holds each
entry to a ceiling of roughly half again its current cost, so the next import
written through a barrel fails there. Files in the closure, before → after:

| entry | runtime | type |
| --- | --- | --- |
| `fetchEachRegion.ts` | 122 → 8 | 378 → 379 |
| `FetchMixin.ts` | 126 → 18 | 374 → 375 |
| `installPerRegionFetchAutoruns.ts` | 126 → 42 | 406 → 407 |
| `MultiRegionDisplayMixin.ts` | 149 → 150 | 430 → 431 |
| `util/fetchContext.ts` | 122 → 4 | 368 → 369 |
| `util/installFetch.ts` | 125 → 14 | 372 → 373 |
| `util/locString.ts` | 4 → 4 | 367 → 8 |
| `util/bpUtils.ts` | 2 → 2 | 367 → 6 |
| `util/assemblyConfigUtils.ts` | 3 → 3 | 367 → 6 |

Three things that reading only the runtime column would miss.

**The type column did not move for the harness, and that is the finding.** Every
one of those files reaches `getSession`, whose return type is
`AbstractSessionModel` — so the 370-odd stands until the session interface
splits, which is [lightweight-toolkit.md](lightweight-toolkit.md) §2 and not
this. The barrel was never the only edge; it was the one that was there by
accident.

*Since taken*: §2 landed later the same day and the type column moved with it —
`fetchContext.ts` 369 → 35, `installFetch.ts` 373 → 40, `FetchMixin.ts` 375 →
44, `fetchEachRegion.ts` 379 → 48. Two barrel edges the session split did not
cause turned up in the way and are also gone: `RpcRegistry.ts` took
`NoAssemblyRegion` from `util/types/index.ts` rather than `data.ts`, and
`regionTooLargeUtils.ts` reached one byte formatter through
`@jbrowse/core/util`. `moduleClosure.test.ts` now holds type ceilings on these
entries too.

*2026-08-25, one layer up*: the sweep had held ceilings only on `util/` and the
fetch harness, and `packages/core/src/ui` turned out to hold the same two
shapes. `MenuTypes.ts`, a React-free type module of 196 lines with one import,
measured **374 files / 47,407 lines** of type closure because it took `Pin` from
`promotableDefaults.ts`, and `Pin` is four members with no dependencies. `Pin`
is now `configuration/promotablePin.ts`, a zero-import leaf that
`promotableDefaults.ts` re-exports; `MenuTypes.ts` is 374 → **2**, and nine
menu-builder modules that reach it collapse with it (`menuItems.ts` 378 → 8,
`filterMenuItems`, `toggleMenuItems`, `launchViewMenu`, `launchTargetsMenuItem`
and `showSubMenu` 374-375 → 3, `promotableMenuItems` and `radioSubMenu` → 4,
`legendMenuItem` → 5).

The second one is the mirror image and worth naming separately. `legendSpec.ts`,
a plain-data legend description, imported `ColorLegendEntry` from
`SvgColorLegend.tsx` while that component imported `LegendSwatch` back from
`legendSpec.ts`: **a type-only cycle between a data module and the React
component that draws it**, worth 375 files. The type moved down to
`legendSpec.ts` and the component re-exports it; 375 → **1**. Neither of these
is a barrel. The barrel was one way a leaf ends up importing an application; a
data type sharing a file with the thing that renders it is another, and it does
not announce itself with an `index.ts` in the specifier.

Both were invisible because `ENTRIES` listed no `ui/` file. It now holds
`MenuTypes.ts`, `menuItems.ts` and `legendSpec.ts`. `menuItems.ts` is there
deliberately: its 8-file closure is the whole builder family, so one ceiling
there fails any builder that takes a type off a module that renders.

**What is left in the runtime column is real.**
`installPerRegionFetchAutoruns` keeps 42 because it reads a track's assembly
names out of a config, and `MultiRegionDisplayMixin` keeps 150 because it
composes `RegionTooLargeMixin` and names the LGV model. Both are coupling those
files actually have. The barrel's cost was that it made 122 and 42 look alike.

**The data half kept its `SnapshotIn` derivation** rather than being redeclared
structurally. It buys a types-only edge into a three-file graph
(`types/mst.ts`, `ElementId.ts`, `nanoid.ts`), which render-core — the leaf this
is modelled on — already exceeds by depending on `@jbrowse/mobx-state-tree`
outright. Redeclaring would have to reproduce
`UriLocation.internetAccountPreAuthorization.authInfo`, which is
`types.frozen()`, i.e. `any`, and is indexed into by three callers.

Still unproven, and unchanged by any of this: **nobody has tried to build the
harness as a separate package.** The graph is small enough now to try.

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
