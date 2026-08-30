---
name: architecture
description: How JBrowse renders a track — display stacks, the worker→main fetch pipeline, SVG export, and the invariants. Read when touching a display or its data flow; the render backend itself is in reference/GPU_RENDERING.md.
---

# Architecture

The canonical reference for how JBrowse renders a track. Read the TL;DR for the
mental model, then jump to the section for whatever you're touching. Deep
subsystems that come up only on a specific task live in their own docs,
collected under [See also](#see-also) at the end.

## TL;DR

- Adapters fetch and parse in an RPC worker; the main thread renders. Worker
  output is **absolute genomic uint32** — never pixels, never region-relative.
- A display is an MST model. `attachRenderingBackend(backend, { upload,
  render })` spawns two MobX autoruns: upload bytes on data change, redraw on
  any visible change. Pan/zoom is a redraw, not a refetch.
- Rendering picks WebGPU → WebGL2 → Canvas2D at runtime behind the HAL. A
  Canvas2D draw fn is the floor for canvas-based displays because SVG export
  runs it; the shader path is an optional accelerator.
- Two fetch foundations cover every **LGV** display: `MultiRegionDisplayMixin`
  (per region, its own autoruns) and `GlobalFetchMixin` (one dataset, display
  installs its own autorun). The non-LGV views (synteny, dotplot) compose
  neither: they own their fetch through `installComparativeFetchAutorun`, a
  wrapper over the shared `installFetch` skeleton, with the flags on
  `SyntenyFetchStateMixin`.
- Every display answers one `displayPhase` getter naming its terminal state —
  `loading` / `error` / `tooLarge` / `ready`, plus `renderError` where there is a
  rendering backend to fail (`DisplayPhase` = that one case on top of
  `DisplayStatusPhase`). `DisplayChrome` renders it, `DisplayStatusChrome` is the
  backend-free half it delegates to, and `SvgChrome` is the export-side gate.
- Shaders are `.slang` compiled by `pnpm gen:shaders`. **Never hand-edit
  `*.generated.ts`.**
- `rpcProps()` = user settings that invalidate the fetch. Putting a fetch result
  in it is an infinite loop; see
  [the trap](#rpcprops-loop-trap-and-how-to-break-it).

## Overview

A **display** is the object that draws one track inside a view — the pileup in an
alignments track, the bars in a wiggle track, the matrix in a Hi-C track. Whatever
it draws, it follows the same shape: a worker fetches and parses off the UI
thread, the main thread uploads the result once and then redraws it every frame,
and the frame goes through whichever of three interchangeable backends the
runtime picked.

```
worker:  adapter → features            (absolute uint32 bp)
                     │  RPC, off the UI thread
                     ▼
main:    model.rpcDataMap              (MST node, observable)
                     │  upload autorun — fires when the data changes
                     ▼
         GPU buffers                   (HAL: WebGPU → WebGL2 → Canvas2D)
                     │  render autorun — fires when anything visible changes
                     ▼
         <canvas> on screen

         SVG export reuses the same Canvas2D draw fn — never the shader.
```

Every canvas-drawing display **must** provide a Canvas2D draw function; the GPU
shader path is an optional accelerator layered on top. Because SVG export runs
the Canvas2D path, on-screen and exported pixels can't drift. Drawing to a
canvas is itself a choice, though: the arc classes paint JSX `<path>` elements
on both paths and touch no canvas at all (circular view's `ChordVariantDisplay`
does the same off this axis entirely); see [Display stacks](#display-stacks).

## Vocabulary

Terms used throughout this doc:

- **Display** — the subject of most of this doc, defined above. Composed from MST
  mixins that supply its behavior: fetch, render lifecycle, height.
- **Backend** — the per-display object that actually draws, either GPU
  (`GpuXxxRenderer`) or Canvas2D (`Canvas2DXxxRenderer`), produced by a factory
  that picks one at runtime.
- **Region / block** — the visible genome is split into regions
  (`view.displayedRegions`) and finer render blocks; a display fetches and draws
  per region. `displayedRegionIndex` is the join key between the model's data map
  and the GPU buffers.
- **HAL** — hardware abstraction layer; hides the WebGPU-vs-WebGL2 difference.
- **RPC / worker** — the off-thread context where adapters fetch and parse data.
- **MST model / autorun** — a display is a `mobx-state-tree` node; `autorun` is
  the MobX primitive that re-runs a function whenever the observables it read
  change.

## Workspace tiers

The three workspace roots are a direction, not three places to put things:

```
packages/*        libraries          (core, render-core, the *-core domain
                    │                 libraries, the leaf utils, and the
                    │                 product-assembly libs product-core /
                    ▼                 app-core / web-core / embedded-core)
plugins/*         plugins            (+ example-plugins/*, same tier)
                    │
                    ▼
products/*        applications       (web, desktop, cli, the embedded React
                                      components, img, capture)
```

Dependencies run **down** this list. Three edges cross it upward on purpose, and
each is recorded with its reason in `scripts/workspaceLayering.test.ts`, which
pins them symmetrically — a new upward edge fails, and so does leaving a stale
entry behind after one is removed.

The check exists because the property was real and invisible. pnpm links every
workspace package into the root `node_modules`, so an undeclared import of any
of them typechecks and runs; and a `dependencies` line is a one-line edit nobody
reads as an architectural change. `@jbrowse/web` was imported by 50 test files
across seven plugins while being declared by none of them. Same doctrine as
`ReExports/abi.test.ts` and render-core's `publicApi.test.ts`: the surface only
moves when someone means it to.

The load-bearing rule is the one with no exceptions — **no plugin ships a
dependency on a product.** A plugin is a library a third party installs; a
product is a whole application. Test-only edges are a separate question and are
allowed onto `@jbrowse/web` alone, which is where `createTestSession` lives.

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally, matching
BED/BAM. Worker output is **absolute genomic uint32** — no regionStart-relative
arithmetic crosses the worker boundary. The precision machinery that makes this
work on a float32 GPU is in [reference/BP_PRECISION.md](reference/BP_PRECISION.md).

**Positions cross the worker boundary cleanly; names do not.** `refName` means
one thing on the main thread and another to an adapter, and which side is
allowed to canonicalize is a rule of its own —
[reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md), summarized
in the root `CLAUDE.md`.

## Where a display's state lives

A new setting has three possible homes, and picking wrong fails silently rather
than loudly. Each has its own JSDoc tag and its own generated doc page:

| home | tag | survives a reload? | read/written as |
| --- | --- | --- | --- |
| config slot | `#slot` | yes — in the track config | `getConf` / `resolveConf`, written with `setConf` |
| MST property | `#property` | yes — in the session snapshot, on the display node | `self.x`, written by an action |
| MST volatile | `#volatile` | no | `self.x`, written by an action |

**The slot is the default, and by a wide margin.** The census below is
**generated** — a display joins it by registering itself with `addDisplayType`,
and its three numbers are the `#slot` / `#property` / `#volatile` tags its own
directory declares. Read the shape rather than any one row: the split is
lopsided everywhere, and on most displays the surviving properties are just
`type` and `configuration`, the structural minimum MST needs. Nearly every
track-menu setting is a slot.

<!-- BEGIN GENERATED DISPLAY_STATE_CENSUS -->

_Generated by `pnpm autogen` — edit the source, not this block._


20 registered displays declare 189 config slots, 42 MST properties and 57 volatiles between them — counting what each display's own directory declares.

<!-- prettier-ignore -->
| Display | Plugin | `#slot` | `#property` | `#volatile` |
| --- | --- | --- | --- | --- |
| `LinearAlignmentsDisplay` | `plugins/alignments` | 46 | 2 | 13 |
| `LinearBasicDisplay` | `plugins/canvas` | 26 | 8 | 12 |
| `LinearMafDisplay` | `plugins/maf` | 18 | 2 | 8 |
| `LDDisplay` | `plugins/variants` | 17 | 1 | 2 |
| `LinearMultiRowFeatureDisplay` | `plugins/canvas` | 12 | 3 | 1 |
| `LinearHicDisplay` | `plugins/hic` | 9 | 2 | 3 |
| `MultiWaySyntenyDisplay` | `plugins/linear-comparative-view` | 8 | 4 | 9 |
| `LinearArcDisplay` | `plugins/arc` | 7 | 2 | 0 |
| `LGVSyntenyDisplay` | `plugins/linear-comparative-view` | 6 | 3 | 0 |
| `LinearManhattanDisplay` | `plugins/gwas` | 6 | 3 | 0 |
| `LinearWiggleDisplay` | `plugins/wiggle` | 6 | 2 | 0 |
| `LinearMultiSampleVariantDisplay` | `plugins/variants` | 5 | 0 | 2 |
| `MultiLinearWiggleDisplay` | `plugins/wiggle` | 5 | 0 | 0 |
| `ChordVariantDisplay` | `plugins/circular-view` | 4 | 3 | 3 |
| `LinearReferenceSequenceDisplay` | `plugins/sequence` | 4 | 2 | 0 |
| `LinearGCContentDisplay` | `plugins/gccontent` | 3 | 0 | 0 |
| `LinearPairedArcDisplay` | `plugins/arc` | 3 | 2 | 0 |
| `LinearMultiSampleVariantMatrixDisplay` | `plugins/variants` | 2 | 0 | 0 |
| `LinearSyntenyDisplay` | `plugins/linear-comparative-view` | 2 | 2 | 4 |
| `LinearVariantDisplay` | `plugins/variants` | 0 | 1 | 0 |
<!-- END GENERATED DISPLAY_STATE_CENSUS -->

Slots a display inherits are in the declaring schema's row, not in its own — the
count is per directory, so `LinearBasicDisplay`'s includes the
`LinearCanvasBaseDisplay` base beside it while a shared fields file outside every
display directory (`heightModeConfigSchemaFields.ts`) is in nobody's.

That works because a slot is not admin-only. A user's edit is diffed into
`trackConfigDeltas` — a frozen `trackId → partial config` map on the session —
so a slot is per-instance *and* persistent without the display model holding it
([ADR-032](architecture-decision-records/adr-032-track-config-nodes-are-throwaway-views.md),
which is also why the hydrated config node is a detached scratch root and
`getSession()` on it throws). Volatiles are for what genuinely dies with the
view: `BaseDisplay`'s own are `error`, `statusMessage`, `statusProgress`.

**The trap is that "a display node" means two different things, and they take
opposite keys.**

- In **config** — `tracks[].displays[]` — the node is built by the display's
  **config schema**. Slots are live here; a state-model property is meaningless.
- In a **session** — `views[].tracks[].displays[]` — the node is instantiated by
  the display's **state model**. Properties are live here, and a slot name is
  dropped exactly like a misspelling: the session loads, the track appears, the
  setting does nothing.

So `"height": 250` on a session display node silently does nothing — `height` is
a `#slot` on `baseLinearDisplayConfigSchema`, not a property. A whole class of
these sat unnoticed in this repo's own fixtures; `jbrowse validate`'s
`checkSessionDisplay` now reports them, and distinguishes the three cases (real
property, slot in the wrong place, legacy key a migration still lifts).

**Migrating one is where the second trap is.** Adding, removing or renaming a
slot needs nothing special — the display `types.union` ignores unknown props, so
a config-schema `preProcessSnapshot` is enough. But rewriting the **value** of an
existing constrained slot (an enum rename, a type narrow) must go through
`addDisplayConfigMigration`, because the union validates the *raw* snapshot
before any schema `preProcessSnapshot` runs: the union rejects the legacy value
first and the hook never fires. A legacy display-instance key that a session
migration lifts onto its replacing slot goes in `migratedDisplayKeys`, so
validate calls it stale rather than dead.

How a slot then reaches the renderer — snapshot, plain object, RPC payload, and
the JEXL callbacks along the way — is
[reference/CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md).

### A stored hover is a volatile the viewport can invalidate

Four things move or remove content under a stationary cursor with no pointer
event to show for it — zoom, `offsetPx`, the display's own `scrollTop`, and the
`regionTooLarge` banner replacing the subtree — so a hit held in a volatile goes
on naming what used to be there. Both LGV foundations install the clear
(`installClearHoverOnViewportChange`) for their families, and a storer outside
them owes its own (`installClearHoverOnSurfaceMove`, `@jbrowse/core/util`).
Deriving the hit from the live pointer instead, as MAF does, needs none of it.
Whichever way, publish it as `hoveredFeature` — `BaseDisplay`'s hook, and what
`LinearGenomeViewContainer` reads to feed `session.hovered`.

Which displays store, which derive, the axes each installer covers, and the MST
constraint behind the second name a storer needs:
[reference/DISPLAY_HOVER.md](reference/DISPLAY_HOVER.md).

## Public developer guides mirror this spec

The hand-written walkthroughs in `website/docs/developer_guides/` —
[creating_display.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_display.md)
(which foundation to compose),
[plotting_features.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/plotting_features.md)
(Canvas2D),
[creating_gpu_display.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/creating_gpu_display.md)
(GPU), and
[data_fetching.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
— turn the sections below into step-by-step tutorials and link back to them. When
the lifecycle, mixins, or upload patterns here change, update those guides in
the same pass. `pnpm check-docs` (which runs
`website/scripts/check-doc-imports.ts`) validates the cross-links both ways but
not the prose.

**Two of those pages are public counterparts to this directory rather than to
this doc**, and they are where a measurement recorded here becomes something an
outside reader can act on:

- [dataflow.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/dataflow.md)
  is the [Overview](#overview) ASCII pipeline as one figure, with the worker,
  the wasm, the three cache layers and the two autoruns located on it.
  `website/diagrams/dataflow.dot` is the source.
- [optimizations.md](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/optimizations.md)
  is the public digest of the measured work in `reference/` — the three clocks,
  the number each optimization moved, and the ones measured as losses. **A new
  measurement lands in its `reference/` doc first**; that doc stays the record,
  and the public page cites it. Keep the two agreeing, and keep the public page
  agreeing with the v5 manuscript's strategy table, which states the same set at
  a higher altitude.

The marker pairs that bracket a generated block, which generator writes each
one, and the generated index of every block in the tree:
[reference/GENERATED_DOC_BLOCKS.md](reference/GENERATED_DOC_BLOCKS.md). Nothing
between a marker pair is hand-editable, here or under `website/docs`.

## Display stacks

Which mixins do you compose to build a display, and why? Linear-genome-view
displays are built from a small set of **foundation mixins** on `BaseDisplay`,
all sharing `baseLinearDisplayConfigSchema` as their config base. Which mixins a
display composes is the primary axis of code sharing; *how* it renders (GPU vs
Canvas2D) is a separate axis layered on top. Two fetch foundations — per-region
(`MultiRegionDisplayMixin`) and single-global (`GlobalFetchMixin`) — cover every
display that lives in an LGV:

The table below is **generated** — both columns. The **Displays** column comes
from the `#displayFoundation` tags (the same scan behind `creating_display.md`),
and **Composes** is read off each foundation's own `types.compose(...)` call, so
a display joins by tagging itself and a mixin change carries itself over. It
lists **composers, not inheritors**: a display that extends another plugin's
whole model is covered by whichever model it extends (see the note after the
table).

<!-- DISPLAY_FOUNDATION_STACKS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Foundation (composed on `BaseDisplay`) | Composes | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `FetchMixin` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `GlobalFetchMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `FetchMixin` | `LinearArcDisplay`, `LinearHicDisplay`, `LinearPairedArcDisplay`, `MultiWaySyntenyDisplay`, `SharedLDModel` |

<!-- DISPLAY_FOUNDATION_STACKS END -->

Read the two rows as: per-region fetch, and one global dataset. Both bring the
render lifecycle. The first installs its autoruns for every display that
composes it — one `installPerRegionFetchAutoruns(self)` from the mixin's
`afterAttach` — while on the second each display installs its own via
`installGlobalFetchAutorun`. `RegionTooLargeMixin`'s gate is derived and opt-in
on both (see [the region-too-large
gate](#the-region-too-large-gate-summary)).

**The global family was two rows until 2026-08-23**, and the split is worth
knowing about because the argument for it reads well and did not survive
contact. `GlobalFetchMixin` was the rendering-agnostic half and
`GlobalDataDisplayMixin` layered `RenderLifecycleMixin` on it, on the reasoning
that arc — which paints main-thread JSX `<path>`s and attaches no rendering
backend — shouldn't drag the render lifecycle in to get
fetch/cancel/too-large/reload. What that bought arc was five unused volatiles
and two autoruns it never installs (`attachRenderingBackend` is what installs
them). What it cost every *other* global display was that three getters —
`canRender`, `paintInert`, `displayPhase` — lived on the upper half, so the
foundation a display composed decided which of them it could express; and it
cost the tables a row that named a mixin composed by exactly two displays. One
foundation now, and arc narrows the one genuinely backend-shaped getter itself:
its `displayPhase` maps through `foundationDisplayStatusPhase`, whose narrower
`DisplayStatusPhase` return type is what lets `DisplayStatusChrome` take it with
neither a cast nor a dead branch, and its `painted` override says that data
arriving — not a canvas that will never be drawn — is its first-paint signal.

**The non-LGV views are a third shape, not a row in that table** — deliberately,
and not a migration nobody finished; folding them onto `FetchMixin` was proposed
and rejected in
[ADR-054](architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md),
which is the thing to read before re-proposing it. Both comparative displays
(`LinearSyntenyDisplay`, `DotplotDisplay`) compose `BaseDisplay` +
`SyntenyFetchStateMixin` (`@jbrowse/synteny-core`) and own their fetch through
`installComparativeFetchAutorun`, a wrapper over the shared `installFetch`
skeleton that adds this family's `fetching` flag and the richer context a `run`
here is handed. And both put their
`RenderLifecycleMixin` *above* the display, so one canvas is shared by several
displays and is laid out by the model that owns it.

That second half is what makes them a shape rather than a variation: keyed
uploads instead of per-region ones, `sharedBackendKey(self.id)` instead of a list
index, an unconditional render callback because the empty frame is what erases a
hidden track, and readiness published as a required prop. All of it, plus the
fetch skeleton's contract, is
[reference/SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md) — read it
before touching either view, or before building any container that owns a canvas
its children draw on.

Circular view's `ChordVariantDisplay` is a fourth shape, off this axis
entirely: it paints main-thread JSX SVG (radial, so on screen it keeps a bespoke
`<DisplayError>` instead of `SvgChrome`), composes none of the fetch
foundations, and answers freshness with its own `ready` getter — one chord fetch
covers the whole view, so there is no spatial or signature axis to compare.
Blanking both halves at fetch start is what that costs it: with `ready` as the
whole freshness answer, a stale refName map left in place would wave a render
through on names the adapter no longer has. It still runs the shared
`computeSvgReady` / `awaitSvgReady` export gate
([reference/SVG_EXPORT.md](reference/SVG_EXPORT.md)), and its fetch is the
shared `installFetch` skeleton like every other one.

### Cross-cutting mixins, orthogonal to the fetch foundation

Several concerns cut across the table above, and each is one mixin with one
overridable hook. Composing the mixin *is* the opt-in; a display that doesn't
override the hook pays nothing.

The table is **generated** from the `#crossCuttingMixin` tags and, unlike the
foundations table, needs no tag on the consumer side: a display joins a row by
composing the mixin, which is read off `types.compose(...)` directly. That is
the whole reason the **Composed by** column exists. A foundation is a display's
spine, so getting it wrong breaks the display and the table drifting is only a
doc bug; a cross-cutting mixin is opt-in, so a display that should have one and
doesn't just quietly does less — and this column is the only place that shows
up. **Read the short rows as questions, not as facts.** A row is also allowed
to name an intermediate mixin rather than a display (`WiggleScoreConfigMixin`
composes `ScoreScaleMixin` on the whole wiggle family's behalf), because the
column reports what actually composes what.

<!-- CROSS_CUTTING_MIXINS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Mixin | The display supplies | Composed by |
| --- | --- | --- |
| `TrackHeightMixin()` | Internal vertical scroll. `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks | `LinearAlignmentsDisplay`, `LinearArcDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearPairedArcDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `MultiWaySyntenyDisplay`, `SharedLDModel` |
| `ContextMenuMixin()` | The right-click state of a display whose menu acts on a | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `LegendMixin()` | A legend the user can turn off. A promotable `showLegend` config slot, whose `promotedBase` sets whether this display type's legend is on by default. Brings the resolved `showLegend` getter, the `showLegendDisplayTypeDefault` pin `showLegendCheckboxItem` takes, and `setShowLegend` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel` |
| `TreeSidebarMixin()` | Row set with a dendrogram sidebar. `sources` (the display rows, named), the three `treeSidebarConfigSchemaFields` slots, plus the `run` callback naming its own clustering RPC and the `sortRows` callback naming what a row carries at a column. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `showTree` / `showBranchLength` / `showRowLabels` getters and setters over those slots, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the `root`, `willClearTree` and `rowOrderIsCustom` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `RowHeightMixin()` | The two-valued row height every multi-row display has. A `rowHeightConfigSchemaFields` slot whose `0` means fit-to-display-height, and an `autoRowHeight` getter saying what that fit divides. Brings the raw `rowHeight` getter, `setRowHeight`, and the resolved `effectiveRowHeight` every consumer reads | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiSampleVariantBaseModel` |
| `HeightModeMixin()` | Track-height strategy; the one row that must compose **after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay` |
| `ScoreScaleMixin()` | Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `*Bound` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume | `LinearAlignmentsDisplay`, `WiggleScoreConfigMixin` |

<!-- CROSS_CUTTING_MIXINS END -->

Each replaced a policy that had been written out per display — four copies of the
scroll clamp, two character-identical copies of grow mode, two implementations of
the score axis. **The interface existed before the implementation every time**
(`ScoreScaleModel`, `installGrowExitBake`'s structural param,
`useVirtualScrollWheel`'s opts, and `TreeSidebarModel` / `TreeDrawingModel` /
`RowHeightModel` for the row family), which is the tell worth generalizing: a
duck-typed contract that several displays satisfy by hand is a mixin that hasn't
been written yet. Look for the contract, not for the duplication — by the time
the bodies look alike they have usually already drifted, and the interface is
the thing that says what they were supposed to agree on.

`HeightModeMixin` must compose **after** `TrackHeightMixin` — it overrides that
mixin's `height` and `resizeHeight`, and `types.compose` resolves a collision to
the later argument. Same hazard as the canvas gate mixin; see [ordering is the
contract](reference/ARCHITECTURAL_LIMITS.md#ordering-is-the-contract).

### The hooks, and who is sitting on a default

The two tables above answer *what a display composed*. This one answers **which
displays override which hook** — the costlier question, since a wrong foundation
breaks the display while every hook below has a default that keeps working and
does less.

Read a short row as a question, the way the cross-cutting table asks it. A
declaration is attributed to the directory it sits in, so a shared model
(`variants/shared`, `wiggle/shared`, `canvas/shared`) names itself rather than
each display composing it.

The generator also asserts every hook is still declared by the file owning its
default: rename that declaration, miss a consumer, and the consumer reads a name
nothing declares — `undefined`, read as a boolean, in silence.

<!-- BEGIN GENERATED DISPLAY_HOOK_OVERRIDES -->

_Generated by `pnpm autogen` — edit the source, not this block._


20 overridable hooks. **Sitting on the default** is what a display that does not override one gets.

<!-- prettier-ignore -->
| Hook | Sitting on the default | Declared by |
| --- | --- | --- |
| `regionFetchKey` | the empty key, so loaded regions never go stale on zoom — correct unless the worker output is zoom-dependent. A subclass that changes what it fetches and forgets the key gets a redundant fetch, not a cached answer for a zoom the data was never fetched at | `alignments/LinearAlignmentsDisplay`, `canvas/LinearBasicDisplay`, `gccontent/LinearGCContentDisplay`, `variants/shared`, `wiggle/shared` |
| `regionHasData` | true — nothing checks that a region marked loaded has data behind it, so a display whose commit sites drift from its stores reads the viewport as covered against data nobody holds, and never asks again | `canvas/LinearBasicDisplay`, `canvas/LinearMultiRowFeatureDisplay`, `maf/LinearMafDisplay`, `variants/shared` |
| `rpcProps` | no `SettingsInvalidate` autorun at all, so no user setting ever refetches (correct for `LinearReferenceSequenceDisplay`, indistinguishable from an omission for anyone else) | `alignments/LinearAlignmentsDisplay`, `canvas/LinearBasicDisplay`, `canvas/LinearMultiRowFeatureDisplay`, `gccontent/LinearGCContentDisplay`, `gwas/LinearManhattanDisplay`, `hic/LinearHicDisplay`, `linear-comparative-view/LGVSyntenyDisplay`, `maf/LinearMafDisplay`, `variants/LDDisplay`, `variants/LinearMultiSampleVariantDisplay`, `variants/shared`, `wiggle/LinearWiggleDisplay`, `wiggle/MultiLinearWiggleDisplay` |
| `fetchNeeded` | nothing is ever fetched | `alignments/LinearAlignmentsDisplay`, `canvas/LinearBasicDisplay`, `canvas/LinearMultiRowFeatureDisplay`, `gwas/LinearManhattanDisplay`, `maf/LinearMafDisplay`, `sequence/LinearReferenceSequenceDisplay`, `variants/shared`, `wiggle/LinearWiggleDisplay`, `wiggle/MultiLinearWiggleDisplay` |
| `viewSignature` | undefined forever, so the display never fetches, `dataCurrent` never goes true and `svgReady` never settles — one track hangs the whole view’s export (fail-hung over fail-stale, deliberately). The comparative displays answer the same freshness question with their own `dataCurrent` compare instead (SVG_EXPORT.md’s signature census) | `arc/shared`, `hic/LinearHicDisplay`, `linear-comparative-view/MultiWaySyntenyDisplay`, `variants/LDDisplay` |
| `layoutReady` | overlays are dropped rather than pinned to a stale layout | `alignments/LinearAlignmentsDisplay`, `canvas/LinearBasicDisplay` |
| `dataSuperseded` | false — `dataCurrent` is the foundation’s own compare alone (spatial coverage plus `isCacheValid` per block, or the signature), which is blind to a load the display invalidates itself: a fetch input it writes from the data it fetched, a debounced key the live view has already moved past, a dependent fetch of its own still out. An export sampling `svgReady` in that window paints the frame that is about to be replaced | `alignments/LinearAlignmentsDisplay`, `gwas/LinearManhattanDisplay`, `linear-comparative-view/MultiWaySyntenyDisplay` |
| `fetchInert` | false, the strict answer, and three things go wrong at once — the loading scrim covers a deliberate static placeholder (and a user cancel parks "Loading canceled / Retry" over it permanently), a resting state that never fetches hangs the whole view’s export, and the retry check reports a dead Retry on a display correctly declining to load. On a comparative display it also hangs `displaysSettled` | `breakpoint-split-view/BreakpointSplitView`, `circular-view/ChordVariantDisplay`, `linear-comparative-view/LinearSyntenyDisplay`, `sequence/LinearReferenceSequenceDisplay`, `variants/LDDisplay` |
| `awaitingPrerequisite` | every decline is judged on the spot by the dev-only retry check, which is right for a display whose fetch answers off its own state — a two-stage one (HiC waits on `CoreGetInfo`, variants on `sourcesBase`) is reported as a dead Retry it does not have, since the run that will fetch is the one after the prerequisite lands. Overriding it DEFERS that verdict, never waives it, so the override has to be strictly narrower than the gate it explains | `hic/LinearHicDisplay`, `variants/shared` |
| `rendersCanvas` | `painted` waits on a canvas that is never mounted, so `data-display-drawn` stays false for the display’s whole life and every `waitForDisplaysDone` on the page burns its timeout | `sequence/LinearReferenceSequenceDisplay`, `variants/LDDisplay` |
| `paintInert` | same, for a fetch that failed before first paint — both fetch families fill it with `!!error`, so a display outside them owes its own | `display-kit` |
| `gateEnabled` | no byte gate: the track downloads whatever it is pointed at, with no banner and no error | `alignments/LinearAlignmentsDisplay`, `arc/shared`, `canvas/LinearMultiRowFeatureDisplay`, `canvas/shared`, `maf/LinearMafDisplay`, `variants/LDDisplay`, `variants/shared` |
| `densityTooLarge` | byte-only gating, no feature-density axis | `canvas/shared` |
| `densityGateEnabled` | no density axis — `canvas/shared` contributes the `true` beside the measurement that fills it, and a display painting into fixed lanes turns it back off | `canvas/shared` |
| `byteGateAdapterPath` | the estimate and the budget both describe the track’s own `adapter` — wrong for a display that reads a different file at different zooms, and the one hook such a display overrides, since `byteGateAdapterConfig` is the config at this path | `maf/LinearMafDisplay` |
| `byteGateAdapterConfig` | the config sitting at `byteGateAdapterPath`, which a tier swap already moves — so this one is for a display whose adapter config is SYNTHESIZED rather than read off the track (GC content folds `windowSize` / `gcMode` in), where no path names what it fetches | — |
| `scrollableHeight` | `Infinity` — the display does not scroll internally | `alignments/LinearAlignmentsDisplay`, `canvas/LinearBasicDisplay`, `maf/LinearMafDisplay`, `variants/shared` |
| `growTargetHeight` | grow mode targets the raw `height` slot | `alignments/LinearAlignmentsDisplay`, `canvas/LinearBasicDisplay` |
| `featureNoun` | `feature`, which is right wherever the generic word already fits — an override changes what CONTENT is called ("Showing 3 variants"), never what a control is called, since "Variant height" reads as a different setting from "Feature height" | `alignments/LinearAlignmentsDisplay`, `linear-comparative-view/LGVSyntenyDisplay`, `variants/LinearVariantDisplay` |
| `featureWidgetType` | the generic `BaseFeatureWidget`. An override is a display whose features have a vocabulary of their own, and its `id` decides which displays share one drawer panel | `alignments/LinearAlignmentsDisplay`, `linear-comparative-view/LGVSyntenyDisplay`, `variants/LinearVariantDisplay`, `variants/shared` |
<!-- END GENERATED DISPLAY_HOOK_OVERRIDES -->

`LinearCanvasBaseDisplay` (plugins/canvas) is **not** a peer of these. It is a
canvas-feature *specialization layered on `MultiRegionDisplayMixin`*, and only
`LinearBasicDisplay` + `LinearVariantDisplay` extend it. Everything else —
wiggle, Manhattan, alignments, MAF, and even the canvas plugin's own
`LinearMultiRowFeatureDisplay` — composes `MultiRegionDisplayMixin` directly.

**Three more displays run on that first row without appearing in it**, and are
meant not to: they extend another plugin's whole model rather than composing the
mixin, so the composer they extend stands for them — the same way
`LinearCanvasBaseDisplay` stands for `LinearBasicDisplay` / `LinearVariantDisplay`
in the row above. `LGVSyntenyDisplay` extends `LinearAlignmentsDisplay` (and is
the one in-tree case of extending `rpcProps()` by super-capture across a plugin
boundary, to add the resolved PIF tier); both GC-content state models extend
`LinearWiggleDisplay`. Don't "fix" their absence by tagging them — that would put
inheritors in a composer table.

What that inheritance *does* demand is checking what you got: the hooks come with
it, and what you inherit may not be the mixin's default. GC-content inherits
wiggle's strict-`bpPerPx` `regionFetchKey`; whether that is right for a new
subclass is a question the tag table can't answer for you (see "Per-region
zoom-staleness").

The arc classes draw **neither** GPU canvas nor Canvas2D: their components emit
JSX `<path>` elements, on screen and in SVG export alike. (`MultiWaySyntenyDisplay`
was built the same way until 2026-08-26; it now draws its ribbons through the
pairwise synteny passes and its lanes through the feature track's glyph passes,
with `DisplayChrome` and a paint layer like any canvas display.) Arc composes
`RenderLifecycleMixin` like every other global display and simply never
*installs* it, since `attachRenderingBackend` is what installs the pair and arc
never calls it. What it does instead of `DisplayChrome` is render
`DisplayStatusChrome` — the backend-free half `DisplayChrome` itself delegates
to, so its chrome is not merely identical to a GPU display's but the same
component, minus the one phase (`renderError`) that needs a rendering backend to
fail. Its `painted` override is the `canvasDrawn` analogue —
`features !== undefined || !!error`, the first-paint signal that gates the
`-done` testid and the loading anti-flash, since nothing here ever flips
`canvasDrawn`. The stricter, staleness-aware `svgReady` is the export gate.

**Render path is a separate axis.** GPU-canvas vs Canvas2D is chosen per frame at
the backend factory
([GPU_RENDERING.md § RenderingBackend interfaces per plugin](reference/GPU_RENDERING.md#renderingbackend-interfaces-per-plugin)),
not by which foundation a display composes.

## Data fetching pipeline

The public
[data fetching pipeline guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
is the tutorial version of this section (the `fetchNeeded` → `fetchEachRegion`
wrapper, `rpcProps`, cancellation, byte gate).

`MultiRegionDisplayMixin` (`packages/display-kit/src/`) drives the per-region
family — the [foundation table](#display-stacks)'s first row, not every LGV
display, since arc, HiC, LD and multi-way synteny are LGV displays on
`GlobalFetchMixin`. Its `afterAttach` is one call to
`installPerRegionFetchAutoruns`, which installs these, plus the stored-hover
clear reaction both LGV foundations install:

<!-- FETCH_AUTORUNS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

`installPerRegionFetchAutoruns` installs four autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` |
| `SettingsInvalidate` | `rpcPropsCacheKey`, the serialized `rpcProps()` return | `clearAllRpcData()`. Installed only when the display defines `rpcProps()` |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |
| `FetchVisibleRegions` | the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry (immediate, then debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |

<!-- FETCH_AUTORUNS END -->

**What the autorun decides and what it merely wires are separate files, and the
split is what either half can be tested against.** `planRegionFetch` answers
"given these inputs, what should happen" as a value — fetch this region set,
raise this assembly mismatch, or do nothing for this reason — and is pure, so
its precedence and its buffered-region substitution need no tree.
`installPerRegionFetchAutoruns` owns what no pure function can state: which
reads MobX tracks and which sit behind a thunk so a run that bails early does
not subscribe to the viewport. The plan's thunk parameters are the only thing it
says about that, the way `computeDisplayPhase` takes its `loading` term as one.
Two test files, one per half; a third (`fetchRegions.test.ts`) covers the commit
ordering. Before the split all three were transcriptions of the autoruns, and
deleting the half-screen prefetch buffer from production left every one green.

**The dependency set is itself a value, and the wiring test states it.** Every
installer builds its reaction through `namedAutorun`
(`@jbrowse/render-core/namedReactions`), which records it against the node as
well as disposing it with one — a bare `autorun` beside an `addDisposer` would
opt that reaction's set out of the tests below and nothing would fail, so there
is one spelling and no second half to forget. `reactionDependencies(node, name)`
answers, as sorted leaf names, what that reaction subscribed to on its last run
— MobX rebuilds the set every run, so the answer is per state. The mutate-and-
count tests above pin one observable each, and only the ones someone thought to
write; the "dependency set is the contract" blocks in
`installPerRegionFetchAutoruns.test.ts` and `RenderLifecycleMixin.test.ts` pin
the whole list per state instead: the two pure signals present in every state,
the viewport present only while the display can act on it, the in-flight and
coverage reads tracked rather than guarded. A read that moves in or out of a body
— a trigger dropped under a gate, a guard that stopped being `untracked`, a dev
check leaking a read — changes the list, whichever observable it was.

### `untracked` names its ground

A body may read untracked what its own effect writes, an input no decision
branches on, or a dev-only check — and nothing else. The test that sorts a read
into tracked or not: **does the decision branch on it?** If so it is tracked,
whatever the idle-run cost. `no-restricted-syntax` fails a bare `untracked(` in
source and each site names its ground on the disable line. The three grounds,
and the two "perf guards" that were measured and deleted:
[reference/FETCH_SKELETON.md](reference/FETCH_SKELETON.md#untracked-names-its-ground-and-a-perf-guard-is-not-one).

### Every fetch autorun runs on the leading edge

Every fetch installer schedules through `leadingEdgeAutorun`
(`@jbrowse/core/util/leadingEdgeAutorun`), and so does the dotplot view's region
autorun. MobX's own `autorun(fn, { delay })` is trailing-edge only — it schedules
the *first* run through `setTimeout` too — so a cold open spent the whole delay
waiting for no interaction to coalesce, and that latency landed on first paint.
The per-region family was the last one still on it, which is the fourteen
display types that cover the common case: display creation to first
`fetchNeeded` measured **683 ms** under `{ delay: 600 }` and **112 ms** after.

Two properties make it safe, and both were found by breaking them:

- **The body reports whether it started work, and only that arms the debounce.**
  A run that bails on a guard — a view not measured, a minimized track, a gate
  shut — returns nothing and stays on the leading edge. `prime()` used to be an
  imperative call the body could misplace; a return value cannot be forgotten.
- **The leading edge is one microtask, not the install call.** A model is
  routinely built and then configured in the same synchronous block, and a fetch
  issued between those two lines is issued against the un-configured state,
  invalidated by the setting that follows, and reissued. Yielding once collapses
  that pair back into one run while still starting three orders of magnitude
  sooner than the timer did. A change arriving after an `await` is a later
  decision and correctly costs a refetch.

**What the 600 ms was hiding, and the thing to check for a fourth.** A fetch that
could not land inside another debounce's first window was a coupling nobody had
to state. The LGV's coarse blocks are on a 500 ms trailing-edge autorun, and two
displays clip a per-bp scan to them so it does not recompute per animation frame
— wiggle's autoscale domain and the alignments coverage scale. Over the *empty*
initial block list both yield no entries, and no entries is not a stale domain
but the fallback one, `[0,1]`: a bigwig line track drew blank and a density
track solid. `settledDynamicBlocks` is the fix and the rule in one place — the
coarse blocks once the view has settled once, the live ones before that — but
the general lesson is the one to carry: **anything downstream of a fetch that
was only ever correct because the fetch was slower than it is a coupling, and
the empty-versus-stale distinction is where it bites.**

**The microtask is what makes install order stop mattering**, and it is worth
knowing that it is the microtask and not the order.
`installPerRegionFetchAutoruns` installs `FetchVisibleRegions` last, which reads
as though it were a constraint. Cold-open RPC count on the canvas harness, all
four combinations:

<!-- prettier-ignore -->
| Leading edge | `FetchVisibleRegions` installed | RPCs on a cold open |
| --- | --- | --- |
| the install call | first | **2** |
| the install call | last | 1 |
| a microtask | first | 1 |
| a microtask | last | 1 |

The duplicate was real while the leading edge was the install call itself: the
three autoruns above it each fire once at install, two of them call
`clearAllRpcData`, and a fetch issued before them was cancelled by
`SettingsInvalidate`'s first pass and reissued with identical arguments — a round
trip per track on every track open, invisible to everything but a call count.
Yielding once retired it, in the same commit that moved the call, so only one of
the two changes is doing work. **A fourth installer owes nothing to install
order; it owes its first run to a microtask.**

### The global-fetch trigger list must be read unconditionally

`installGlobalFetchAutorun` reads the viewport, `isMinimized`, the
`rpcProps()` cache key (`FetchMixin.rpcPropsCacheKey`, for the reason in "the
cache key is the return value, not the reads") and `reloadCounter` at the top of
its body,
*before* the display's `prepare()`, and that ordering is load-bearing. MobX
rebuilds the dependency set on every run, so a read placed inside the gate drops
out of it on any run that decides not to fetch — and can then never wake the
autorun again. Arc is the shape that exposes this: its `prepare` declines while
`dataCurrent`, which goes true on every successful fetch, so with
`reloadCounter` read under the gate `reload()` was silently dead.

**`prepare` returning `undefined` is the display's gate**, and it is one
function rather than a predicate plus a bail-out prefix inside the fetch — the
two used to answer the same question in two places, one of them tracked and one
not. It runs synchronously in the autorun body, so whatever it read to decline
stays in the dependency set and the autorun rewakes on it; and it runs under
`autorunOnReadyView`, so a `prepare` restating `view.initialized` is restating
the skeleton. What it must not do is move a trigger read of its own under a
bail-out, which is the failure this section exists for.

The general rule, which the other fetch autoruns already satisfy: **a gated
trigger read is safe only if the gate is itself an observable that flips on the
transition you want to wake up on.** `if (self.isMinimized) return` above the
tracked deps (synteny, tree-sidebar, the variant sources autorun) is fine —
un-minimizing re-runs the body and re-reads everything. A pure signal like
`reloadCounter`, whose only job is to say "go again" and which no gate consults,
is the dangerous case: nothing else will ever re-run the body on its behalf.
`installGlobalFetchAutorun.test.ts` pins this.

A gate on a freshness signal must also be invalidated by `reload()` — bumping
`reloadCounter` alone re-runs the autorun but leaves the gate declining. On the
global family that pairing is structural now: `runGlobalFetch` gates on the
mixin-derived `dataCurrent`, and `GlobalFetchMixin.reload()` drops
`loadedFetchSignature` in the same action (keeping the display's data, so the
stale frame stays under the loading overlay instead of blanking). Arc and HiC
each carried their own copy of that override before the mixin owned it, and the
copies were the reason the rule had to be remembered.

**The shared skeleton owns the same pairing, for the fetches no check covers.**
A gate on committed state is `installFetch`'s `fetchKey`, not a compare in
`prepare`: the skeleton stamps the key at commit and declines on it, and a run whose `reloadCounter` has
advanced since the run that last *issued* a fetch ignores it, so a reload
refetches with nothing to clear. The split matters because only one of the two
declines can strand a display — `prepare` returning `undefined` is "nothing to
fetch" (an empty viewport, no annotation track configured), a legitimate decline
forever that no retry should change, while the key gate is "I have exactly
this", which a retry must override. The stamp is observable — the skeleton's
own `observable.box`, or the host's `loadedFetchKey` where the comparative
mixin already keeps one — because a commit landing after the inputs moved back
is what has to wake the declined run; a closure variable leaves the late
commit's data under the earlier viewport. The comparative wrapper folds the
adapter config into the key, since neither display's `currentFetchKey`
carries one and an adapter edit would otherwise wake the autorun into a
decline. This exists because a **secondary** fetch
passes no `contract` and so installs no `makeRetryContractCheck` (one ledger per
node, one `lastCounter` per check — two would each demand a fetch from one
bump), and the multi-way synteny display's two dependent fetches shipped the
dead Retry in that blind spot: a committed key compared by hand in `prepare`,
with no `reload()` override to match. Pinned in `installFetch.test.ts`, which is
where a rule belongs once the skeleton holds it rather than each display.

**The per-region twin: a `fetchNeeded` that declines to fetch must be woken by
something `FetchVisibleRegions` already tracks.** That autorun tests
`isBlockCovered(...) && isCacheValid(...)`, and `&&` short-circuits, so on a run
where the block is uncovered `isCacheValid`'s observables register no
dependency. It's safe only because an uncovered block always reaches
`fetchNeeded`, and a fetch bumps `fetchGeneration` — which the autorun tracks. An
override returning early **without** fetching breaks that chain and must supply
its own wake path from the existing dependency set. Both in-tree cases do:
sequence's `zoomedOut` moves with `bpPerPx`, so `visibleRegions` re-fires it;
multi-sample variant's `!sourcesBase` clears through `SettingsInvalidate`,
because `rpcProps().sampleFilter` is derived from `sourcesBase` and goes from
`undefined` to a list the moment it arrives. That is also why `sampleFilter`
spells the unfiltered case out in full rather than reusing `undefined` for it:
collapsing the two would leave the key unchanged when sources landed, and the
display would wedge with nothing drawn. Same failure mode as the global rule
above — the autorun settles into a state nothing will wake it from.

**The comparative twin, and why this is a law rather than one installer's
quirk.** `installComparativeFetchAutorun` reads `reloadCounter` above its
`prepare()` bail-outs for exactly the reason arc does, and it was added the same
way — by finding both non-LGV views unable to recover from a fetch error,
because after a failure every fetch input is unchanged and clearing the error
alone refires nothing. So every fetch in the tree now carries the same pure
signal, read unconditionally, each pinned by its installer's test:

| family | installer | the pure signal | a user cancel lapses on | pinned by |
| --- | --- | --- | --- | --- |
| per-region | `installPerRegionFetchAutoruns` | `fetchGeneration` | a viewport change, or Retry | `installPerRegionFetchAutoruns.test.ts` |
| global | `installGlobalFetchAutorun` | `reloadCounter` | a viewport change, or Retry | `installGlobalFetchAutorun.test.ts` |
| comparative | `installComparativeFetchAutorun` | `SyntenyFetchStateMixin.reloadCounter` | Retry | `installComparativeFetchAutorun.test.ts` |
| everything else | `installFetch` (`@jbrowse/core/util/installFetch`) | `reloadCounter` | Retry, where the host has a cancel at all | `installFetch.test.ts` |

Read the table as the checklist for a fifth: if you add a fetch skeleton with a
gate, it needs a signal the gate never consults, read above the gate, and a test
that fails when the read is deleted. The fourth row is the general one — the
prerequisite reads (HiC's header, the multi-sample sample list), the circular
view's chord fetch and the breakpoint split view's overlay fetch all run on it,
and it reads the signal for them.

**A cancel is durable, and one rule now says how durable.** No fetch trigger
un-cancels it — the skeleton reads `fetchCanceled` tracked, under the counter
and above every gate, so the two gestures that reopen it are in the dependency
set of the run they closed. Those two are Retry and, on the LGV families, the
viewport moving: the thing the user stopped is no longer the thing they are
looking at. The global family had no half of this — it read the flag nowhere, so
a pan walked straight into `runFetch`, which resets it, and the load came back on
its own. The comparative family has the gate and not the lapse, because its
viewport **is** its fetch input: the same clear there would un-cancel on every
trigger, which is exactly the durability this rule rejects.

**`reloadCounter` is one declaration for both LGV families.** It lives on
`FetchMixin`, the one mixin `MultiRegionDisplayMixin` and `GlobalFetchMixin`
both compose — the argument that already put `fetchInert` there, applied to two
identical volatiles that had nothing keeping them identical. The comparative
family keeps its own on `SyntenyFetchStateMixin` (ADR-054); chord and the
breakpoint view declare their own, because none of them composes `FetchMixin`.

### One latest-wins machine, one phase contract, one skeleton

**begin → clear the error → run → commit if still current → `handleFetchError`
→ end.** That sequence was written five times, each copy missing a different
rule. It is `runFetchOnce` (`@jbrowse/core/util/installFetch`) now, and
`installFetch` is that plus the autorun over it: the rotation, the leading edge,
the unconditional `reloadCounter` read, the durable cancel gate, and the two
dev-only contract checks. What is left per site is exactly the parameter list.
The pieces underneath, and who reaches each directly:
[reference/FETCH_SKELETON.md](reference/FETCH_SKELETON.md).

### The region-too-large gate (summary)

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It's a **derived** getter on `RegionTooLargeMixin` — a pure function of the last
byte measurement — and what keeps that measurement describing what is on screen
is that a blocked display keeps fetching, once per settled viewport, with the
fetch stopping at the measurement rather than downloading. So the banner releases
on a fresh index read, with no imperative clear and no flicker on pan. There is
one measurement path (since 2026-08-23): the feature RPC itself measures, so a
display opts in with `gateEnabled` and by passing `byteLimit` in its call, plus
`byteGateAdapterPath` / `densityTooLarge` where a tier or a density axis
applies (`configuredFetchSizeLimit` / `configForceLoad` are plain slot reads,
not part of the overridable hook surface). Canvas adds the density axis via
`CanvasFeatureGateMixin` (`plugins/canvas/src/shared/`), which the base canvas
display composes — the multi-row display runs on the byte axis alone — and which
`no-restricted-syntax` requires after `MultiRegionDisplayMixin()`; the shared
verdict/threshold/banner-text primitives live in
`packages/display-kit/src/regionTooLargeUtils.ts`.

Full detail — the byte gate, the opt-in hooks, how the verdict is built, and the
shared decision primitives: [reference/REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md).

### `rpcProps()` loop trap and how to break it

Including any fetch-result derivative in `rpcProps()` creates an infinite loop:

```
setCellData → <derived value> changes → rpcProps() changes
  → SettingsInvalidate → clearAllRpcData → cellData cleared
  → <derived value> changes → rpcProps() changes → …
```

The fix is to split the computation: `rpcProps()` gets a cache-key version
computed from user-controlled inputs only; any part that needs fetch-result data
is kept in a separate view used only for rendering or passed directly to the
server.

In the variant case, `rpcProps().sampleFilter` calls `getSources` with
`renderingMode: 'alleleCount'` internally (through `sourcesBase`) so haplotype
expansion — which needs `sampleInfo` — is never triggered. The client's `sources`
view still reads `sampleInfo` for rendering, safe because it is not in
`rpcProps()`. The worker expands to haplotype rows itself, after computing
`sampleInfo` from the features.

**Rule:** `rpcProps()` must contain only user-controlled settings. Never include
`cellData`, `sampleInfo`, or any getter that reads them.

Because both families key on the *returned* payload (see "the cache key is the
return value, not the reads"), the loop needs a fetch-derived value to reach the
**return** — one merely consulted while building can't loop. That is the whole
reason HiC gets away with `activeNormalization` reading fetched
`availableNormalizations`. It also sets where the loop shows up: per-region it is
a synchronous freeze, caught by `makeSettingsLoopGuard`'s within-tick counter;
on the global family `installGlobalFetchAutorun` reads the key and fetches in one
debounced body, so it loops on the async-fetch cadence instead, which no
within-tick counter can tell apart from fast interaction. See
`packages/display-kit/CLAUDE.md` for the overridable
hook list and test-file mapping.

### Row order is not a fetch input

The three row-stacking displays all keep the *order* rows are drawn in out of
the RPC, and each pays for it in a different currency:

| display | what crosses | who assigns the row |
| --- | --- | --- |
| multi-wiggle | the full canonical `sources` list, as a **structural** arg (absent from `rpcProps()`) | the main-thread encoder, from `gpuProps().sources` |
| MAF | `subtreeFilter` only | `placeMafRegionData`, keyed on species name, re-run by a placement autorun |
| multi-sample variant | `sampleFilter` (sorted sample names) | `placeVariantRows`, keyed on `rowNames`, re-run by the derived region map |

The shared rule: **a fetch argument may name the row *set*, never the row
order.** The set is real work — a focused clade is a fraction of the cells or
the sequence — while the order is a permutation the main thread can apply for
free. Sent unsorted, a set puts the order back in through the JSON cache key
even though no worker reads it, so sort it.

A drag-reorder, a "Group by", a clustering run and a genotype sort are then all
re-uploads of bytes already in hand; under positional row identity each of them
re-downloaded and re-computed the whole window. It also removes a class of bug,
since a payload numbered against a row list the display isn't drawing renders
every row under another row's name — which is how both plugins found this.

Two things to get right when doing it again:

- **Name the rows in the payload** (`rowNames` / `sampleId`) and place by name.
  A row the display isn't drawing must not fall back to row 0; variants sends it
  to a `HIDDEN_ROW` sentinel that every painter's existing Y-cull discards, MAF
  drops it.
- **Placement must not disturb an ordering something else depends on.** The
  variant cell arrays are sorted by `(featureIndex, rowIndex)` in the *worker's*
  numbering and the hit test binary-searches that, so placement writes a second
  array and leaves the sorted one alone.

### The sequence adapter is derived, not passed

BAM/CRAM decode against the reference, but a track's adapter config doesn't
carry it — the assembly does. The config rides **alongside** `adapterConfig` as
a sibling RPC arg, and **no caller passes it**: `renameRegionsIfNeeded` already
resolved the assembly, so it supplies one to every renaming RPC for free.
`CoreGetRefNames` is the one exception, because it is what renaming calls. Why
that beats documenting a rule, and the set-once instance field behind it:
[reference/SEQUENCE_ADAPTER.md](reference/SEQUENCE_ADAPTER.md).

## GPU rendering architecture

This section is the summary; full detail lives in
[reference/GPU_RENDERING.md](reference/GPU_RENDERING.md).

A GPU display composes `RenderLifecycleMixin` and calls
`self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied to
the model's lifetime: `upload(backend)` pushes bytes to the GPU when the data
changes, `render(backend)` draws a frame when anything visible changes. MobX
auto-tracks every observable read inside each callback, so nothing declares
dependencies by hand. React components are thin bridges — create a canvas, hand
the backend to the model via `useRenderingBackend` (called inside
`DisplayChrome`), render JSX.

The rendering primitives live in **`@jbrowse/render-core`**
(`packages/render-core`): the HAL, `RenderLifecycleMixin`, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. It is a
leaf package (deps: `mobx` + `@jbrowse/mobx-state-tree` + `react` peer; **no**
`@jbrowse/core`), so a third-party display can depend on it directly. The GPU
API is **static-import-only** — never exposed via the runtime `ReExports`
registry ([ADR-030](architecture-decision-records/adr-030-render-core-package-static-import-only.md)).

What the GPU doc covers, so you can jump straight in:

| Section | Read when |
| --- | --- |
| The core contract / The API / What the mixin owns | Wiring a new display's render lifecycle |
| Life of a frame | Debugging "why didn't it redraw", context loss, tab visibility |
| RenderingBackend interfaces per plugin | Writing a backend factory; going Canvas2D-only |
| Keeping the two backends in parity | Touching either a `.slang` or a Canvas2D draw fn |
| Upload patterns / `installUpload` | Choosing what a display keys its payloads by; O(N²) upload bugs |
| HAL / Renderers stay stateless | Touching `packages/render-core/src/hal/` or renderer state |
| Shaders (Slang codegen) | Editing a `.slang` or a generated module |
| Canvas scaling & hi-DPI / `displayedRegionIndex` | Blurry canvases; region↔buffer join keys |
| What this architecture deliberately does not have | Before proposing a render graph, indirect draws, GPU culling, or SSBOs |
| Adding a new GPU display type | The end-to-end checklist |

### Terminal states early-return their own root

The chrome branches on `model.displayPhase` (`renderError` in
`DisplayChromeBase`, `tooLarge` one level down in `DisplayStatusChromeBase` —
the split is about which banner needs the backend hook's `retry()`, not about
the tree shape, which is identical for both). For either banner it
early-`return`s it as the component's *entire* output,
replacing the display subtree, rather than keeping the container `<div>` mounted
and swapping the banner in beside the canvas. The caller's
`className`/`ref`/mouse handlers are absent in those two states. Two of those
three are free — a too-large region has no canvas to interact with, and the ref
re-attaches on force-load. **The mouse handlers are not**, and the chrome pays
for them explicitly; see the pointer bullet below. What makes it the right
shape:

- **Clean GPU dispose/re-init.** Early-`return` unmounts the canvas subtree,
  which fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
  `stopRenderingBackend()`; force-load remounts and re-inits via the callback
  ref. Nesting the banner beside a still-mounted canvas would skip that cycle.
  Unmounting is safe precisely because that full dispose→re-init cycle runs.
- **The loading term stays lazy.** `computeDisplayPhase(self, loading)` takes
  `loading` as a thunk and calls it only after ruling out the terminal flags, so
  when a banner is up the chrome's observer tracks only that flag, not the
  view's churning `visibleRegions`/`loadedRegions`.
- **The chrome drops the pointer measurement itself**, which is the price of the
  shape rather than a bonus. `mouseleave` cannot fire on an element unmounted
  under the cursor, so without a compensating effect the tracker goes on
  publishing the position the pointer had when the banner went up — invisible
  while the banner is there, then read by the body on its **first** render after
  Force load or Retry, drawing a crosshair where the cursor is not.
  `DisplayChromeBaseInner` runs `handleMouseLeave()` on the transition for
  exactly this, and `DisplayChrome.test.tsx` pins it ("the pointer measurement
  drops when the container is replaced", whose third case is the negative
  control: an *overlay* phase keeps the position, because the container is still
  there). A container that owns a pointer measurement and can unmount its own
  subtree owes the same clear.
- **React Compiler opt-out.** `DisplayChromeBaseInner` carries `'use no memo'`,
  so babel-plugin-react-compiler doesn't compile it and can't memoize a MobX read
  on `model`'s stable identity. That opt-out is also why `return`-vs-ternary is now
  a style choice: what stays load-bearing is *replacing the subtree*, not how the
  replacement is spelled. Full analysis:
  [reference/COMPILER_TERNARY_FINDING.md](reference/COMPILER_TERNARY_FINDING.md).

The rest of the shared chrome — the phase precedence, the retry affordances, the
overlay components — is in
[reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md).

## SVG export

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Every LGV display's
`renderSvg.tsx` is one call — `renderDisplaySvg(model, opts, XxxSvgBody)` — which
awaits `svgReady` (failing the whole export if that track's data wouldn't load),
resolves the export geometry, and mounts `SvgChrome` (the "region too large"
terminal, the only one a figure draws) around the display's body component. The
body paints
via `paintLayer` at the `canvasWidth` the shell hands it, **not** the
outline-adjusted width the on-screen canvas uses. That on-screen width is
`MultiRegionDisplayMixin`'s `canvasWidthPx` (`= lgv.trackWidthPx`), and it is a
getter rather than a note on each display because the choice was being made by
copying whichever neighbour the author read first, out of four plausible view
getters — MAF had drifted onto `view.width` and sized a canvas that overhangs the
track container's 2px outline under `contain: strict`. **A getter alone did not
hold it** — ten call sites went on reading `view.trackWidthPx` beside it, and
nothing failed because the two agree, which is the hazard rather than the
reassurance. `no-restricted-syntax` bans the read everywhere but the getter, the
same treatment `setSlot` and the named `observer` get. Export is the documented
exception to it: the export shell has no outline, so `renderSvg` overrides
`canvasWidth` with the shell's own width (`LgvSvgBodyProps`). The full
contract — the `svgReady`/`settled` freshness gates, the one permitted TypeScript
narrow, `paintLayer`'s raster-vs-vector dispatch, the JSX-SVG exception classes,
and model-scoped clip ids — is in
[reference/SVG_EXPORT.md](reference/SVG_EXPORT.md).

**`awaitSvgReady`'s only bound is a half-hour backstop, so every resting state
that never fetches must be terminal.** A correct `dataCurrent` says whether held
data is current; it cannot say whether data will ever arrive. So read a display's fetch gate and ask
what leaves it false indefinitely — a user toggle inside it (LD's
`showLDTriangle`), an unmet prerequisite (HiC's `prepare` needs an
`effectiveResolution`, which `CoreGetInfo` supplies), a static "zoom in" mode
(sequence). Each such state has to reach `svgReady` through `error`,
`regionTooLarge`, `fetchCanceled` or `fetchInert`, or one track hangs the whole
view's export with the dialog spinner up and nothing said. A standing user
cancel is such a state — durable until Retry or a viewport change, and an
export causes neither — so `computeSvgReady` takes it as a required terminal
and `awaitSvgReady` fails the export on it the way it fails on `error`,
matching the "Loading canceled / Retry" the user is looking at. Two cases are already
handled for you: minimized tracks, which `SVGLinearGenomeView` filters out, and
the viewport holding no content block at all (`showAllRegions` on a
scaffold-level assembly, where every region elides — the only way in), which
both LGV foundations answer through `viewportEmpty`. No display in the view can
fetch there, so it was every one of them hanging the export at once rather than
one.

**Enumerate every way the prerequisite fails, not just the throw.** HiC's
header read (a secondary `installFetch`) `setError`s on a thrown `CoreGetInfo`
— but one that *resolves* carrying no binsize list leaves
`effectiveResolution` undefined just as thoroughly, with no exception to
catch, so the empty list needs its own `setError` in the commit. A gate on a
fetched value has as many resting states as that value has empty shapes.

**The on-screen twin: the same states are terminal for the loading overlay.** A
first-load overlay is `!ready && !error`, and `ready` means "a fetch landed" — so
a resting state that never fetches spins it forever, for the same reason and with
less excuse than the export, since the user is looking at it. Answer it once and
read that one getter everywhere, as `LinearSyntenyDisplay.fetchInert`
(`isMinimized || !connectedViews`) does for its fetch autorun's gate, its
`loading`, and its `svgReady` `extraTerminal`. Deriving the export's terminal set
separately from the overlay's is how they drift: synteny's `svgReady` named both
states while `loading` named neither.

**The reader you will forget is the one outside the display.** Those three are
all display-local, so a fourth — `displaysSettled` (`@jbrowse/synteny-core`),
which both comparative views' `settled` gate and so their `*_canvas_done` testid
run through — went on demanding `dataCurrent` from a display whose
`loadedFetchKey` can never be set. That is why `fetchInert` is an overridable
hook on `SyntenyFetchStateMixin` (default `false`) rather than a getter each
display invents: a cross-display consumer can only read a name the mixin
declares. Default `false` is the strict answer, so a display that grows an inert
state and forgets to declare it hangs (diagnosable) rather than reporting done
with nothing drawn.

## `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both are
MST view methods (not getters), so subclasses extend them via the standard
`super` capture pattern spelled out below.

**The method-shaped fetch hooks must live in `.views()`, never `.actions()`.**
MobX runs an action inside `untracked`, so declaring `rpcProps`,
`regionHasData` or `isCacheValid` as an action makes its reads register no
dependency and every caller silently keeps a stale answer — no error, no crash,
and it has regressed twice. **A declaration inside an `.actions()` block is a
`no-restricted-syntax` error** in source, which carries the reason;
`regionFetchKey` needs no rule, because MST throws on a getter declared inside
`.actions()`, so only the method-shaped hooks can regress this way.

**`assertDisplayContract` is what remains a runtime check**: a display that
wrongly chains to `super` in its own `afterAttach` re-enters the fetch
foundation's hook and installs every autorun twice, and so does composing two
fetch foundations or calling an installer a mixin already called — a state, not
a spelling. Dev-only, and `console.error` rather than `throw` (an error escaping
`afterAttach` reads as an invalid track and the display is dropped, hiding the
very violation it reports).

**Every installer calls it**, once per display, from whichever installed that
display's autoruns: `installPerRegionFetchAutoruns` for the per-region family,
`installGlobalFetchAutorun` for the global one, `installComparativeFetchAutorun`
for the comparative one, and the shared `installFetch` for everything else —
which is what finally got it onto chord and the breakpoint overlay fetch. A
**secondary** fetch on a display whose foundation already installed the checks
passes no `contract` and skips both (the multi-way synteny display's two
dependent fetches are that case: its global foundation installed them): a second `assertDisplayContract` would
report the double-attach it exists to catch, and a second retry check would eat
the same `reloadCounter` bumps as the first. So a new skeleton owes the same
call, beside the pure "go again" signal [the trigger
list](#the-global-fetch-trigger-list-must-be-read-unconditionally) asks it for.

It lives in `@jbrowse/core` rather than beside the mixin that first needed it,
which is what lets the comparative family reach it at all: the installer is in
`@jbrowse/synteny-core`, and a package importing from a plugin is the upward
edge [workspace tiers](#workspace-tiers) records by exception. The checker needs
nothing from either — `getMembers` and `untracked` — so the tier it belongs to
is the lowest one that can hold it.

Their predecessor `renderProps` belonged to the removed server-side block
system and is gone from the tree entirely — it survives only in
[reference/HISTORICAL.md](reference/HISTORICAL.md), so don't reach for it as a
live precedent.

| Method | Consumer | Invalidation route |
| --- | --- | --- |
| `rpcProps()` | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | The **serialized** payload, in both families — per-region `SettingsInvalidate` reads `FetchMixin.rpcPropsCacheKey` → `clearAllRpcData` → refetch; global `installGlobalFetchAutorun` reads the same getter in its trigger list → refetch. See "the cache key is the return value" below |
| `gpuProps()` | `buildSourceRenderData(data, self.gpuProps())` — encoder input | Upload callback reads it — MobX re-uploads without an RPC roundtrip |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap` | Upload autorun reads it — MobX re-uploads without an RPC roundtrip |
| `renderState` | `backend.render(state)` per frame | Render callback reads it — re-fires when deps shift |

### What each tier costs when it moves, and who is zoom-sensitive

**Censused 2026-08-30.** The three tiers are not three flavours of the same
thing — they differ by two orders of magnitude in what a change costs:

| tier | a change does | cost |
| --- | --- | --- |
| `rpcProps()` | `rpcPropsCacheKey` moves -> `SettingsInvalidate` -> `clearAllRpcData()` | refetch every region |
| `gpuProps()` | the identity `installUpload` compares moves (`p !== lastProps` clears `encodedFrom`, `installUpload.ts:195-198`) | **re-encode every cached region, main thread, no RPC** |
| `renderState` | the render callback re-fires | repaint |

The middle row is the one that surprises, because it is O(cached regions x
features) of main-thread work with nothing on the network to make it visible.
[ADR-016](architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md)
is the measurement of exactly that cost, taken when the proposal was to move
wiggle's pos/neg split main-thread-ward; the same accounting applies to anything
that lands in `gpuProps()`.

**Only one `gpuProps()` in the tree is zoom-sensitive at all**, and it is
deliberate: `LinearMafDisplay`'s `binBp` reads `encodeBinBp`
(`plugins/maf/src/LinearMafDisplay/stateModel.ts:1315-1327`), which is
`subPixelBinBp(view.coarseBpPerPx)` — the **debounced** copy, quantized to a
power of two precisely so a gesture does not thrash it
(`subPixelBinBp.ts:19-22`: unquantized, "MAF re-encodes every region on every
wheel tick"). So a sustained zoom can re-encode every cached MAF region, but
only on crossing a power-of-two boundary after the debounce settles. Every other
`gpuProps()` reads session or config state only — none reads live `bpPerPx`,
`offsetPx`, `visibleRegions`, `dynamicBlocks` or hover.

**That is the invariant to preserve.** A per-frame viewport value reaching
`gpuProps()` re-encodes the whole cache mid-gesture, silently, and the profile
blames the encoder rather than the key that let it in.

Two other facts the census turned up, neither a bug:

- **`bicolorPivot` fans out to all three tiers**, which no single comment says.
  `rpcProps()` (the worker owns the avg-path split, ADR-016), `gpuProps()` (the
  whiskers bands are coloured main-thread, and the SVG export calls
  `buildSourceRenderData(data, gpuProps)` directly), and `renderState` as
  `origin` (the shader's bar pivot and density fade). Each hop is commented
  where it happens; the fan-out is only visible from here.
- **Six of fourteen `installUpload` callers pass neither `inputs` nor
  `encode`** — gwas, sequence, `LinearSyntenyViewHelper`, `MultiWaySyntenyDisplay`,
  alignments, the two multi-sample variant displays and dotplot. That is the
  typed no-`encode` overload, not an omission: `cells()` already yields encoded
  data, built by a `computed` upstream (`LinearSyntenyDisplay.computedColors`,
  `DotplotDisplay.computedColors`), so MobX's own map diff limits the re-encode
  instead of `installUpload`'s clear. HiC and LD take a third route — `encode`
  with no `inputs`, keying the colour ramp as its own map entry so only its
  identity change re-encodes it.

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `stopToken`) are
spread in at the RPC call site, keeping `rpcProps()` focused on its purpose:
cache keys for `SettingsInvalidate`. Every display follows the same call shape:

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  adapterConfig: self.adapterConfig,  // inherited from BaseDisplayModel
  regions, bpPerPx,                    // per-call values
  ...self.rpcProps(),                  // user settings (cache keys)
  stopToken, statusCallback,
})
```

`sessionId` belongs in the **first** argument only — `RpcManager.call` injects
it into the payload, and `AssertNoCallLevelFields` fails a registry entry that
declares it in its args. Passing it again in the object is redundant; no call
site does anymore.

`adapterConfig` is provided by `BaseDisplayModel` (via
`getConf(this.parentTrack, 'adapter')`) — and is a **structural** arg, so it is
absent from the cache key. That matters for the one display whose adapter config
is itself a function of user settings: GC content folds `gcMode` / `windowSize` /
`windowDelta` into the `GCContentAdapter` config its `adapterConfig` getter
builds, so it lists those three in `rpcProps()` purely as cache keys. A display
that overrides `adapterConfig` from mutable state has to do the same, or its
settings change nothing until something else invalidates.

**Override it only to change what the adapter *is*, and never to annotate it.**
`dataAdapterCache` keys on the config object (`adapterConfigCacheKey`), so a key
the adapter never reads still forks the cache: the decorating display resolves
its own instance and its own parse of the file, while every plain reader of the
same track — another display type over it, a `CoreGetFeatures` probe behind a
launch dialog — shares a second one. `LinearSyntenyDisplay` returned
`{ name: <the adapter's own type>, assemblyNames: <a slot its config schema does
not declare, so always undefined>, ...adapter }`, and paid a duplicate parse of
every PAF it shared with `LGVSyntenyDisplay` or the region-launch mate discovery.
Both keys were inert at the adapter — which is exactly why nothing caught it. If
a worker-side value genuinely doesn't belong to the adapter, pass it as a sibling
RPC arg, the way `sequenceAdapter` is passed.

`rpcProps()` is the **only** extension point for the RPC payload. Each display
defines its own typed shape; subclasses that layer on fields capture `super` and
spread:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      const base = superRpcProps()
      return {
        ...base,
        displayConfig: { ...base.displayConfig, geneGlyphMode: self.effectiveGeneGlyphMode },
        showOnlyGenes: self.showOnlyGenes,
      }
    },
  }
})
```

`MultiRegionDisplayMixin` does **not** provide a base default — declaring one
would widen the typed return through MST's `.views()` chain and force consumers to
re-spread named fields. The mixin's `SettingsInvalidate` autorun looks up
`rpcProps` dynamically and is installed only when the method exists, so a
per-region display with no settings-driven refetch (e.g.
`LinearReferenceSequenceDisplay`) can simply not define it. HiC and LD compose
`GlobalFetchMixin` rather than MultiRegion, and both *do* define
`rpcProps()`.

### The cache key is the return value, not the reads

Both families invalidate on the **serialized** payload — never on the raw call —
and `serializeRpcProps` is the one implementation of that, reached through one
getter, `FetchMixin.rpcPropsCacheKey` — watched by `SettingsInvalidate`
per-region and read in `installGlobalFetchAutorun`'s trigger list globally.

The reason is that **building the payload reads far more observables than it
returns**, so tracking the call tracks all of them:

- canvas builds it from a whole config snapshot (`getConfigSnapshotWithPromotables`),
  which reads *every* slot on the display config and on every schema it inherits
  — so a `showLabels`, `heightMode` or compact/normal `displayMode` flip, none of
  which is in the payload, would refetch
- HiC's `activeNormalization` consults `availableNormalizations`, which is
  **fetched** (`CoreGetInfo`) — a read that has nothing to do with user intent

Serializing collapses both: only a change in what's returned invalidates. And it
has to be a string rather than a `.rpcProps()` comparison, because a fresh object
never compares equal.

The inverse hazard, since `JSON.stringify` *is* the comparison: a field whose
distinct states serialize identically is a **silently dead cache axis** — changing
it refetches nothing and raises no error. A class instance needs a `toJSON` or it
flattens to `{}` (`SerializableFilterChain` has one, which is what makes the
variant displays' `filters` field a real key), and an `undefined` value drops its
key entirely, so it can't be distinguished from a sibling state that also drops.
Prefer primitives and plain arrays. Regression-tested in
`installGlobalFetchAutorun.test.ts` ("ignores an observable rpcProps() reads but
does not return"), which fails if the trigger goes back to the raw call.

### Pick the payload out of the snapshot; never subtract from it

Serializing fixes *which reads* invalidate. It does nothing about **which slots
are in the payload**, and that is a second, separate hazard for any display whose
`rpcProps()` starts from `getConfigSnapshotWithPromotables`: the snapshot carries
every slot the display's schema *and every schema it inherits* declare, so the
payload's contents are decided by whatever the display does with it.

Do that by picking the slots the worker reads. Canvas's `pickDisplayConfig` copies
exactly the keys its `DisplayConfig` interface declares, off a
`Record<keyof DisplayConfig, true>` — which TypeScript checks exhaustive in **both**
directions with no helper type, erroring on a key the list omits and on a name that
is not a key. That is what makes the list safe to have: it cannot drift from the
interface the worker actually reads through.

The subtractive spelling — snapshot minus a destructured exclusion list — is the
one to avoid, and it is the one you write first. Its failure is silent and
compounding:

- **A slot nobody thought to exclude becomes an RPC cache key.** Canvas's list
  reached ten names, and the expensive one was `height`: the resize handle writes
  it on every drag frame (`TrackContainer` → `resizeHeight` → `setConf`), so
  dragging a track taller re-ran the whole worker pipeline.
- **The names that leak come from a schema in another package.**
  `BaseLinearDisplay`'s schema contributes most of them, so a contributor adding a
  main-thread slot there has no reason to look at a display plugin's `rpcProps()`.
- **The payload type has to be a lie.** A snapshot-minus-exclusions object is a
  superset of the worker's config interface, so it reaches the typed RPC args
  through an `as DisplayConfig` cast — which is exactly the assertion that would
  have caught the extras.

Picking inverts all three. A new worker slot means editing the interface and the
key list together, and forgetting means the feature does not work — which someone
notices. A new main-thread slot means editing neither.

**A slot that is in the payload only to invalidate it gets its own field** —
once the config half is a pick of what the worker reads, anything riding along
for the cache key alone has nowhere left to hide in it. The rule survives its
one former instance: `LinearBasicDisplay`'s gateSlots field (the raw gate
budget slots, sent purely so an edit stayed a refetch) was deleted 2026-08-21
when the
question [REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md) had left open was
settled — a budget edit reaches the verdict through tracked reads, so the field
only ever bought a redundant full refetch of regions already loaded and in
budget. What the pick had already settled is that the question was *askable*,
because the slots sat somewhere a reader could see them instead of being
residue an exclusion list happened not to mention.

### `gpuProps()` and derived region maps — re-upload without refetch

`gpuProps()` exists wherever the main thread encodes the GPU buffer — wiggle,
multi-wiggle and MAF (and GC-content, which inherits wiggle's wholesale). HiC and
multi-LGV synteny fill the same role without the method: HiC's upload callback
reads `self.colorScheme` straight into `generateColorRamp`, and synteny's
`computedColors` getter is its re-upload-without-refetch half. Canvas joined
the method on 2026-08-23: its worker emits a color *class* per themed lane and
the main-thread encode resolves classes against `session.palette`, so the
worker holds no palette and a theme change re-encodes. This splits refetch from
re-upload: wiggle color change → re-encode only; `bicolorPivot` change → worker
output differs → `rpcProps()` → refetch.

**Opacity is a render parameter, never a packed color.** Both comparative
displays own a `computedColors` getter — the gpuProps half — and both keep the
plot-wide opacity slider *out* of it: synteny multiplies it in `fillShade`,
dotplot in `dotplot.slang`'s fragment (`color.a * u.alpha`), each fed from the
render state (`SyntenyTrackRenderParams.alpha` / `DotplotRenderState.alpha`) with
a Canvas2D twin so the SVG export matches. Dotplot used to bake it into every
packed ABGR byte, which turned one drag frame into three full O(n) passes —
recompute the colors array, re-pack every instance, re-upload the buffer — for a
value that was identical on every instance. **A per-instance array is the wrong
home for a scalar**: if a setting multiplies every element by the same number,
it belongs in the uniform/draw params.

A genuine recolor does still produce a fresh `colors` array over the same
coordinate arrays, and a naive keyed-upload backend re-packs every lane to change
one. The two-line memo that avoids it is a backend concern:
[GPU_RENDERING.md § Upload patterns](reference/GPU_RENDERING.md#upload-patterns),
under "the color-lane patch".

Derived region maps apply when upload needs whole fresh per-region payloads, not
just encoder parameters. Alignments' `laidOutByGroup` returns, per group, shallow
clones of that group's `rpcDataMap` entries with freshly-allocated Y arrays from
main-thread layout (+ connecting-line / Flatbush in chain mode); `sourceSections`
pairs each with its arc feed and is what the upload callback iterates. Raw
`rpcDataMap` is never mutated. Use derived maps
when settings change the shape/contents of per-region data; use `gpuProps()` for
scalars fed to an encoder.

That the raw map is never mutated is also what fixes how it is *represented*:
build it with
[`regionDataMap()`](../packages/render-core/src/regionDataMap.ts),
which is a **shallow** `observable.map`. An entry that can never change has
nothing for MobX's deep enhancer to observe, so the observable-object graph it
builds per entry on insert — and the proxy hop it adds to every field read — buys
no reactivity at all
([ADR-060](architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
Every per-region volatile in tree goes through the helper; writing
`observable.map<number, …>()` by hand is the thing to notice in review.

**A derived map is a tier, so keep its cheap half out of its expensive half.**
Alignments splits the one above in three: `laidOutByGroupUncolored` does row
placement, `laidOutByGroupFramed` applies the chain strand frames, and
`laidOutByGroup` bakes the per-read color arrays over it. Nothing
in the color half can move a read's row, so folding the color settings into the
layout computed — which is what `groupLayoutContext` used to do — made a recolor
re-run placement, every per-feature Y remap and the modification Flatbush to
change two arrays. Split, the layout computed stays memoized across a recolor,
and because the overlay *spreads* its input rather than rebuilding it, `readYs`
survives with it: the GPU renderer reads that identity as "same layout run" and
rewrites the read pass alone (GPU_RENDERING.md, "Whole-map synced: skipping a
region without leaving stale buffers"). The same reasoning applies to any value a derived map
reads but only *sometimes* spends — the band-overhead input to the grouped fit
budget is a thunk for exactly that reason, so band geometry stays out of the
layout computed's dependency set on the ungrouped path.

### Theme-derived render inputs are session getters, not pushed volatiles

Color palettes are a pure function of the active theme, so derive them in a model
getter — `<plugin builder>(getPaletteHost(self).palette)` — that `gpuProps()` /
`renderState` read directly. Do **not** stage them in a volatile that a React
`useEffect` pushes in via a `setColorPalette` action: the effect runs only on
mount, so SVG export and RPC — neither of which has a component — see a null
palette and render blank. As a getter the value is always present and MobX
recomputes it only when the theme changes: same re-encode invalidation, no mount
dependency. Every palette builder in tree reads that one session input —
`buildColorPaletteFromPalette` (alignments), `getMafColorPalette` (MAF),
`buildColorPalette` (reference sequence), canvas's `themedColorTable`, the
multi-sample variant and multi-way synteny palettes, and `treeStroke` /
`treeHoverColors` (tree-sidebar, whose consumer is a drawing autorun rather
than `gpuProps()` — same rule, since an autorun has no component either).

**Read `session.palette`, not `session.theme`.** Both are required on
`AbstractSessionModel` and both resolve from the same `resolvePalette` call, so
they cannot disagree — but they are for different consumers, and only one is a
render input:

- `palette` (`JBrowsePalette`) is what *rendering* reads: plain color strings,
  no toolkit, serializable, so it crosses the RPC boundary and works headless.
- `theme` is the resolved MUI `Theme`, for the components that are MUI.

Embedded products without `ThemeManagerSessionMixin` supply both off a
`themeOptions` getter (`EmbeddedSessionThemeMixin`). No display sends a theme
to the worker any more; SVG export still overrides the palette with the
*export* theme — `resolvePalette({ configTheme: opts?.theme })`.

## Per-region zoom-staleness

All worker position output is **absolute genomic uint32**, so data stays valid
under zoom. The exceptions are for zoom-dependent *content*, not coords.

No display writes the cache predicate. `MultiRegionDisplayMixin` computes
`isCacheValid(idx)` from two terms: `regionHasData(idx)`, and whether the fetch
key stamped on that region still equals `regionFetchKey`. `FetchVisibleRegions`
calls it per region and refetches the ones that fail. A display states its rule
as those two hooks, which are two different questions:

- **`regionFetchKey`** (default `''`) — what a fetch issued *right now* would
  produce, as a string. `fetchRegions` reads it in its synchronous prefix,
  before the RPC goes out, and stamps that value beside the loaded region; a
  region whose stamp no longer matches is stale.
- **`regionHasData(idx)`** (default `true`) — whether the last fetch stored
  anything for this region, where "stored" and "marked loaded" can differ by
  design. A byte-gate refusal stamps nothing (`fetchRegions` and the fan-out
  helpers skip the commit for a refused result), so the fail-open default is
  unreachable from the gate; what keeps the default `true` is sequence's
  empty-result path, which stamps a legitimately empty region without storing —
  a store-derived default would refetch it forever.

Keeping them apart is what lets a display say "the data is fine, it just isn't
here" without inventing a key value for absence — a key that changed when data
arrived would be the `rpcProps()` loop in different clothes.

**`isCacheValid` is also a term of `dataCurrent`, which is the export gate and
not the scrim.** Spatial coverage answers "is the data here", never "is it what
a fetch now would bring back", so a zoom moving `regionFetchKey` leaves every
held region covered and stale at once — and an export sampling `svgReady` across
the 600ms `FetchVisibleRegions` debounce plus the RPC painted wiggle's bins, the
variant matrix's columns and canvas's amino-acid wall as the previous zoom
computed them. Reusing the cache predicate rather than minting a second stamp
compare carries `regionHasData` along with it, so MAF's summary/detail tier flip
inside a loaded region closes the export gate too, until the other tier's fetch
lands.

**The `isCacheValid` conjunct does not reach `displayPhase`, deliberately.**
`MultiRegionDisplayMixin` hands `foundationDisplayPhase` a
`viewportWithinLoadedData` thunk and reads `dataCurrent` nowhere, so the loading
scrim still stays down through a zoom inside the buffer. Folding staleness into
the phase is a different fold and still rejected —
[reference/REJECTED_IDEAS.md](reference/REJECTED_IDEAS.md) §"Folding content
staleness into `displayPhase`".

**That conjunct cannot latch, and the reason is structural rather than a case
list.** `planRegionFetch` refetches a block on
`!(isBlockCovered && isCacheValid)`, reading `isCacheValid` tracked on every
block it does not already owe a fetch for. So the key move that closes the
export gate is the same read, in the same dependency set, that wakes the refetch
reopening it. The `&&` short-circuits in front of it — a blocked byte gate, an
uncovered block — drop `isCacheValid`'s observables only where the block reaches
`fetchNeeded` regardless.

**Four declarations key on zoom:**

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one from
  `bpPerPx / resolution`, so the key is `String(view.bpPerPx)` and any zoom
  change refetches all visible regions together. See
  [ADR-008](architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md).
  It sits on `WiggleCommonMixin`, the wiggle-shaped-*fetch* mixin, rather than
  on the `WiggleScoreConfigMixin` that mixin composes: the rule is about what a
  fetch returns, and `LinearManhattanDisplay` composes the score config alone
  while fetching untransformed SNPs.
- **Canvas** (`LinearBasicDisplay`): the amino-acid overlay is the only
  `bpPerPx`-dependent worker decision, so the key is that discrete threshold —
  `String(shouldRenderPeptideBackground(view.bpPerPx))` — and every other zoom
  change reuses the cached features. `laidOutDataMap` uses `coarseBpPerPx`
  (debounced 500ms) so Y-row packing doesn't recompute on every animation frame
  during smooth zoom.
- **Multi-sample variant matrix**: columns lay out by feature index across the
  visible width, so which features show is a function of the current zoom even
  when the viewport stays spatially inside loaded data. The key is
  `cellDataMode === 'matrix' ? String(bpPerPx) : ''` — wiggle's rule in matrix
  mode only, since the *regular* variant display draws each variant at its
  genomic position.
- **Alignments** (`LinearAlignmentsDisplay`): the two per-base colour schemes
  sample the wall at a sub-pixel bin, so what the worker's extract holds for a
  region is a function of zoom. The key is `String(perBaseBinBp)`, which is one
  constant string in every other colour scheme, and `perBaseBinBp` is
  `subPixelBinBp` over the **debounced** `coarseBpPerPx`. That same getter rides
  to the worker as a call-site RPC argument, so the key describes the fetch that
  was actually issued.

  Keying live `bpPerPx` instead would not be wrong for flipping more often: the
  quantization flips the bin once per octave either way, and wiggle keys on live
  `bpPerPx` outright. It is wrong because `FetchVisibleRegions` runs on the
  leading edge and then *throttles* at 600ms rather than settling. It runs while
  a gesture is still moving, and a live key hands each of those runs the bin of
  a zoom the gesture is only passing through. Every one of those mismatches
  refetches the one pipeline whose worker extract is the OOM the bin exists to
  bound, and latest-wins cancels the RPC, not extract work already running. The
  debounce costs no latency where a user would feel it, since every discrete
  placement flushes the coarse blocks itself (`settleCoarseBlocks`) and only the
  continuous zoom and drag paths wait out the 500ms.

**Three answer presence instead**, and the last of them is the zoom case that
looks most like a key:

- `LinearMultiRowFeatureDisplay` and canvas both return `rpcDataMap.has(idx)`
  as deliberate defense-in-depth: a refused region is never marked loaded on
  any current path, so these overrides decide which way a future drift between
  the commit sites and the stores would fail — as a refetch, not a freeze.
- **MAF**: zoom picks *which fetch runs*, not a resolution — zoomed out with a
  configured summary adapter it pulls cheap per-species summary rows, zoomed in
  the full alignment. Crossing that threshold inside an already-loaded region
  wouldn't move the region bounds, so MAF keeps the empty key and answers
  `showSummary ? summaryDataMap.has(idx) : rpcDataMap.has(idx)`.

  A `summary`/`detail` *key* would be a regression rather than a tidier
  spelling of the same thing. The two tiers cache side by side:
  `clearAlignmentData` runs one way only, so a detail fetch keeps the summary
  records and zooming back out reuses them. Under a tier key the stamp reads
  `detail`, every zoom-out reads as stale, and the byte-gated summary adapter is
  re-read each time. `LinearMafDisplay/summaryTierSwap.test.ts` pins both
  directions. Worth stating once, since the shape recurs: **"which map holds it"
  is a presence question, not a staleness one.**

**A third hook sits beside those two and is not a cache question at all:
`dataSuperseded`** (default false). The cache hooks decide whether a region is
refetched. This one decides whether a settled fetch-input change is about to
invalidate what is held, which is an export-readiness question: it is the fourth
term of `dataCurrent`, beside spatial coverage, a non-empty `loadedRegions` and
`isCacheValid` per block, and `dataCurrent` is the freshness half of
`foundationSvgReady`. `GlobalFetchMixin` declares the same hook over its
signature compare — `dataCurrent` there is `signatureCurrent && !dataSuperseded`,
and only the first term gates the fetch — so a display with a dependent fetch
of its own (multi-way synteny's lane genes) holds the export without re-running
its primary fetch.

The window `dataSuperseded` covers is invisible on screen, since the clear lands
a tick later and the loading scrim covers it, which is exactly why it needs
stating. `awaitSvgReady` samples freshness once, so an export sampling it inside
that window renders the data that is about to be discarded, or nothing at all
once the clear lands mid-render.

Every override in tree is a display invalidating its own load rather than the
viewport moving off it:

- **GWAS Manhattan**: adopting the top hit as the LD index SNP is an `rpcProps`
  write, so the load that produced the top hit is the load it invalidates.
- **Alignments**: the per-base bin, as one value compare —
  `perBaseBinBp !== livePerBaseBinBp`. Once the settled bin moves, the stamp
  stops matching `regionFetchKey` and the foundation's `isCacheValid` term
  covers it; this display carried that compare privately until the foundation
  took it. What no key can state is the 500ms `coarseBpPerPx` debounce ahead of
  it, where the settled bin has not moved yet, the clear is inevitable but not
  yet committed, and the wall on screen is already several octaves coarser than
  the zoom it is drawn at. That is the half an export lands in, since a reader
  zooms and then reaches for the menu.

**It fails hung, not stale**, the same trade `viewSignature` makes: a
supersession that latches true never lets `dataCurrent` go true again, and every
export of that display then waits out `awaitSvgReady`'s backstop instead of
failing. So a supersession compare states only the half it can prove, and leaves
key strings to the key.

**`regionFetchKey` is a getter, so MST makes it a computed.** That is the point
— the observables it reads join `FetchVisibleRegions`' dependency set, where an
action's reads would be untracked and the autorun would keep a stale answer. The
cost runs the other way: a key that reads anything *non*-observable is memoized
for the display's life and never invalidates, so the display caches its first
fetch forever and nothing refetches it. It caught the foundation's own test
harness first, where the knob behind the key had to become a volatile rather
than a closure value (`perRegionTestEnv.ts`).

## What not to do

The index of this doc's rules, and complete rather than meant to be: a rule
stated anywhere above gets a line here, so scanning this section is scanning the
spec. Nearly all of them fail *silently* — that is what makes them worth listing
rather than trusting to review. A section this index never points at has to say
it carries no rule, in `STATES_NO_RULES`; six do. Three real rules sat unindexed
while that was prose.

**Every entry is stated flat and argued elsewhere**, so every entry links the
section or reference doc that argues it —
`website/scripts/check-architecture-checklist.ts` fails one that links nothing,
and fails a link whose target a rename took away. An entry that grows a
paragraph of reasoning instead is a section that hasn't been written yet: it
hides from anyone who reads the spec rather than the checklist. Three were
allowed to become that — the hover rule, the renderer-held region map and the
nested-view readiness flag — and each has since been given the section it
wanted.

### State, config and composition

- Don't reach for a new MST property when a config slot would do — the slot is
  the default, and a user's edit persists through `trackConfigDeltas` either
  way. And don't write a slot name onto a *session* display node: that node is
  built by the state model, so the key is dropped in silence. See [where a
  display's state lives](#where-a-displays-state-lives).
- Don't rewrite the *value* of an existing constrained slot without
  `addDisplayConfigMigration`. The display `types.union` validates the raw
  snapshot before any schema `preProcessSnapshot` runs, so the union rejects the
  legacy value first and the hook never fires; adding, removing or renaming a
  slot needs none of this. See [where a display's state
  lives](#where-a-displays-state-lives).
- Don't canonicalize a refName worker-side. `renameRegionsIfNeeded` renamed
  `regions[]` before the call, so a second pass renames a name already in the
  adapter's namespace; main-thread text goes through `getCanonicalRefName`, and
  alignments layout looks worker-side and is not. See [coordinate
  system](#coordinate-system).
- Don't give a plugin a dependency on a product. A plugin is a library a third
  party installs and a product is a whole application, so a runtime edge there
  puts an app in the plugin's dependency closure — the one workspace rule with
  no exceptions. A test-only edge is allowed onto `@jbrowse/web` alone. See
  [workspace tiers](#workspace-tiers).
- Don't re-implement a cross-cutting mixin's policy in a display. `scrollTop`
  clamping, grow-mode height and the score axis each arrive by overriding one
  hook (see [Cross-cutting
  mixins](#cross-cutting-mixins-orthogonal-to-the-fetch-foundation)); a
  hand-rolled copy is how four displays came to hold four spellings of the same
  scroll clamp.
- Don't compose `HeightModeMixin()` before `TrackHeightMixin()`. It overrides
  that mixin's `height` and `resizeHeight`, and `types.compose` gives the
  collision to the later argument, so the wrong order silently drops grow mode —
  and the two `height` getters agree in fixed mode, so no value gives it away.
  `no-restricted-syntax` fails the wrong order written in one `types.compose`
  and says what it costs —
  [ordering is the contract](reference/ARCHITECTURAL_LIMITS.md#ordering-is-the-contract).
- Don't chain to `super` in a display's own `afterAttach`. Our MST fork
  auto-chains lifecycle hooks, so calling it installs every fetch autorun twice;
  `assertDisplayContract` reports it in dev, from whichever installer put the
  display's autoruns in. Regular actions still use super-capture. See [the
  pattern](#rpcprops--gpuprops-pattern).

### Fetch

- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()`; it is an infinite fetch loop. See
  [the trap](#rpcprops-loop-trap-and-how-to-break-it).
- Don't declare `rpcProps`, `regionHasData` or `isCacheValid` in `.actions()`.
  MST runs an action `untracked`, so their reads register no dependency and
  callers silently keep a stale answer; `no-restricted-syntax` fails the
  declaration in source and says why. See [the
  pattern](#rpcprops--gpuprops-pattern).
- Don't let a per-frame viewport value reach `gpuProps()`. A change to it
  re-encodes **every cached region** on the main thread with no RPC, so a live
  `bpPerPx`, `offsetPx` or `visibleRegions` read there does that mid-gesture,
  silently — and the profile blames the encoder rather than the key. MAF's
  `binBp` is the one zoom-derived entry and is debounced and power-of-two
  quantized for exactly this reason. See [what each tier
  costs](#what-each-tier-costs-when-it-moves-and-who-is-zoom-sensitive).
- Don't put a pure "go again" signal under a fetch gate. `reloadCounter` and
  friends must be read unconditionally, above the bail-outs — a read inside the
  gate drops out of the dependency set on the run that declines, and nothing
  ever wakes the autorun again. Every fetch carries one; see [the
  trigger list](#the-global-fetch-trigger-list-must-be-read-unconditionally).
- Don't override `fetchNeeded` to return early *without* fetching unless
  something `FetchVisibleRegions` already tracks will wake it. A fetch bumps
  `fetchGeneration`; an early return that skips the fetch breaks that chain and
  must supply its own wake path. See [the trigger
  list](#the-global-fetch-trigger-list-must-be-read-unconditionally).
- Don't give a new fetch installer its first run at the install call. It owes
  that run to a microtask: a model is routinely built and then configured in the
  same synchronous block, and a fetch issued between those two lines is issued
  against un-configured state and reissued. Install order then stops mattering.
  See [the leading edge](#every-fetch-autorun-runs-on-the-leading-edge).
- Don't leave something downstream of a fetch that is only correct because the
  fetch is slower than it. That is a coupling nobody has stated, and the
  empty-versus-stale distinction is where it bites — an empty block list is not
  a stale domain but the fallback one. `settledDynamicBlocks` is the in-tree
  fix. See [the leading edge](#every-fetch-autorun-runs-on-the-leading-edge).
- Don't read something `untracked` because tracking it looks expensive. The
  test is whether the decision branches on it: if it does, it is tracked
  whatever the idle-run cost, and the only three grounds are a self-write, an
  effect input and a dev-only check. `no-restricted-syntax` fails a bare
  `untracked(` and each site names its ground. See [`untracked` names its
  ground](#untracked-names-its-ground).
- Don't measure bytes anywhere but in the feature RPC. `gateEnabled` is the
  one opt-in and `byteLimit` in the call is the whole display-side contract;
  a separate estimate round trip is the pre-flight path no display issues
  (`CoreGetRegionByteEstimate` survives for track export alone). See
  [the gate summary](#the-region-too-large-gate-summary).
- Don't pass `sessionId` twice. `RpcManager.call` injects the first argument
  into the payload, and `AssertNoCallLevelFields` fails a registry entry that
  declares it. See [the pattern](#rpcprops--gpuprops-pattern).
- Don't ship a `rpcProps()` field whose distinct states serialize identically.
  `JSON.stringify` *is* the comparison, so a class without `toJSON` flattens to
  `{}` and an `undefined` drops its key — a silently dead cache axis that raises
  no error. See [the cache key](#the-cache-key-is-the-return-value-not-the-reads).
- Don't build a config payload by subtracting from a whole-config snapshot. Pick
  the slots the worker reads, off a key list the compiler checks exhaustive
  against the interface it reads them through; a name nobody thought to exclude
  is a silent RPC cache key, and most of them are inherited from a schema in
  another package. A slot present only to invalidate gets its own named field.
  See [pick the payload](#pick-the-payload-out-of-the-snapshot-never-subtract-from-it).
- Don't pass `sequenceAdapter` from a display or a dialog. `renameRegionsIfNeeded`
  derives it from the assembly it already resolved, so a hand-written one is the
  same two lines every other caller deleted. See [the sequence adapter is
  derived](#the-sequence-adapter-is-derived-not-passed).
- Don't override `adapterConfig` to *annotate* it; only to change what the
  adapter is. The cache keys on the config object, so a key the adapter never
  reads still forks the cache into a second instance and a second parse of the
  same file. Pass a worker-side value as a sibling RPC arg instead. See [the
  pattern](#rpcprops--gpuprops-pattern).
- Don't send row *order* to the worker. A fetch argument may name the row set —
  real work — but the order is a permutation the main thread applies for free,
  and sent unsorted it re-enters the cache key anyway. See [row
  order](#row-order-is-not-a-fetch-input).
- Don't write a `regionFetchKey` that reads no observable. The hook is a getter,
  so MST makes it a computed, and a key over non-observable state is memoized
  for the display's life — the first fetch is cached forever and nothing
  refetches it. See [per-region zoom-staleness](#per-region-zoom-staleness).
- Don't answer "which map holds this region" with `regionFetchKey`. Presence is
  `regionHasData`; a key spelling it reads as stale the moment the display swaps
  tiers, and refetches the tier it already holds. See [per-region
  zoom-staleness](#per-region-zoom-staleness), and [the hook
  table](#the-hooks-and-who-is-sitting-on-a-default) for what every other
  unoverridden hook leaves you with.
- Don't restate `regionFetchKey`'s string vocabulary in a second derivation. The
  foundation compares the stamp against the key already, as `dataCurrent`'s
  `isCacheValid` term, so a supersession compare states only the live-vs-settled
  half and states it as a **value** compare; a second spelling reads `"16|fine"`
  against a live `"16"` the day the key grows an axis, latches true, and every
  export of that display waits out `awaitSvgReady`'s backstop instead of
  failing.
  `LinearAlignmentsDisplay`'s `dataSuperseded` is the worked example. See
  [per-region zoom-staleness](#per-region-zoom-staleness).

### Upload and render

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` — it
  belongs in the MST autorun pair spawned by `attachRenderingBackend`. See [GPU
  rendering](#gpu-rendering-architecture).
- Don't destructure model methods; call on the model
  ([GPU_RENDERING.md](reference/GPU_RENDERING.md)).
- Don't use `useMemo` for observable-dependent values; use a cached MST view
  ([GPU_RENDERING.md](reference/GPU_RENDERING.md)).
- Don't mutate per-region values in place; emit fresh objects. See [derived
  region maps](#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't build a per-region map with a bare `observable.map<number, …>()`. Use
  `regionDataMap()` from `@jbrowse/render-core/regionDataMap`, which is shallow: an entry
  nothing mutates has nothing for MobX's deep enhancer to observe, so the
  per-entry observable graph and the proxy hop on every field read buy no
  reactivity ([ADR-060](architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
- Don't size an on-screen canvas from `view.trackWidthPx`, or from any of the
  other three plausible view getters. Read `MultiRegionDisplayMixin`'s
  `canvasWidthPx`; `no-restricted-syntax` bans the underlying read everywhere
  but that getter, because a second spelling agrees until it doesn't. SVG export
  is the documented exception — the shell has no outline, so `renderSvg`
  overrides `canvasWidth`. See [SVG export](#svg-export).
- Don't key a shared backend by a list index. Use `sharedBackendKey(self.id)` —
  an index renumbers the moment a sibling is hidden, aliasing one display's
  buffer onto another's slot
  ([SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md)).
- Don't size a shared canvas from the displays drawing on it; the model that
  owns it lays it out. A band with no display is legal, and reserving 0px there
  while the canvas still paints overlaps the row below
  ([SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md)).
- Don't skip a shared canvas's render tick when there is nothing to draw — an
  empty frame is what erases a hidden track. Those three, and the rest of the
  shared-canvas contract, are
  [reference/SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md).
- Don't fold a scalar into a per-instance array. If a setting multiplies every
  element by the same number — plot-wide opacity is the case that bit — it
  belongs in the uniform or draw params, not re-packed across every instance.
  See [derived region
  maps](#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't fold cheap work into an expensive derived map. Split the tier so a
  recolor doesn't re-run row placement; see [derived region
  maps](#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't make a renderer class the *owner* of per-region data. The model's
  `rpcDataMap` / `laidOutDataMap` is the single source of truth, passed in per
  frame; a renderer-held map is legal only under the conditions in
  [GPU_RENDERING.md § Renderers stay
  stateless](reference/GPU_RENDERING.md#renderers-stay-stateless), which
  alignments alone meets.
- Don't add or redefine volatiles/actions owned by the slot mixin (`canvasDrawn`,
  `renderTick`, `currentRenderingBackend`, `renderError`, `markCanvasDrawn`,
  `resetCanvasDrawn`, `renderNow`, `setRenderError`, `stopRenderingBackend`, etc.).
  `renderError` in particular is the single source for the `renderError` terminal
  phase — don't fork it into a display-local volatile. See
  [GPU_RENDERING.md](reference/GPU_RENDERING.md).

### Chrome, readiness and export

- Don't leave a resting state that never fetches non-terminal. `awaitSvgReady`'s
  only bound is a half-hour backstop, so a user toggle, an unmet prerequisite, a
  standing user cancel or a static "zoom in" mode must reach `svgReady` through
  `error`,
  `regionTooLarge`, `fetchCanceled` or `fetchInert` — otherwise one track hangs
  the whole view's export with the dialog spinner up. Enumerate every way the
  prerequisite fails, not just the throw. See [SVG export](#svg-export).
- Don't ask readiness from a view's raw `bodyMounted`; ask
  `effectiveBodyMounted`, which folds in the answer of every view this one is
  nested inside. The raw flag reads `true` for a nested view that is out of the
  DOM, and every display in it then waits for a first paint nothing will make.
  See [VIEW_INIT.md § a nested view's
  `bodyMounted`](reference/VIEW_INIT.md#a-nested-views-bodymounted-reads-true-while-it-is-out-of-the-dom).
- Don't let a container unmount its own subtree while holding a pointer
  measurement. `mouseleave` cannot fire on an element unmounted under the
  cursor, so the tracker goes on publishing the position the pointer had when
  the banner went up, and the body reads it on its first render after Force load
  or Retry — a crosshair where the cursor is not. `DisplayChromeBaseInner` runs
  `handleMouseLeave()` on the transition. See [terminal
  states](#terminal-states-early-return-their-own-root).
- Don't derive the export's terminal set separately from the loading overlay's.
  They are the same states, plus two readers outside the display
  (`displaysSettled`, the retry check), which is why `fetchInert` is one mixin
  hook rather than a getter each display invents
  ([ADR-082](architecture-decision-records/adr-082-one-hook-for-a-display-that-will-not-fetch.md)).
  See [SVG export](#svg-export).
- Don't stage theme-derived colors in a volatile that a React `useEffect`
  pushes in. The effect only runs on mount, so SVG export and RPC — neither of
  which has a component — render blank; derive them in a getter. And read
  `session.palette`, not `session.theme`: the palette is the serializable,
  toolkit-free one that crosses the RPC boundary. See [theme-derived render
  inputs](#theme-derived-render-inputs-are-session-getters-not-pushed-volatiles).
- Don't **store** a hover without clearing it on viewport change, and don't leave
  the clear to the pointer handlers — they cover only the case where the pointer
  is what moved. Either install
  `installClearHoverOnViewportChange` or derive the hit instead; see [a stored
  hover](#a-stored-hover-is-a-volatile-the-viewport-can-invalidate).
- Don't publish a hover under a name of your own. `hoveredFeature` is
  `BaseDisplay`'s hook and the view reads it across every display; a display that
  spells it differently drops out of `session.hovered` in silence. A stored hit
  goes in a differently-named volatile with a getter over it — MST refuses to
  instantiate a volatile over a base computed. See [a stored
  hover](#a-stored-hover-is-a-volatile-the-viewport-can-invalidate).
- Don't install the hover clear yourself *under `MultiRegionDisplayMixin`*, and
  don't skip overriding `clearHoveredFeature` if you store one — the mixin
  installs the reaction and that one action is all a storer owes it. Outside
  that family nothing installs it, so a display or view that stores a hover owes
  the whole reaction — `installClearHoverOnSurfaceMove`
  (`@jbrowse/core/util`), which the two comparative views and the breakpoint
  split view each call with their own transform key. See
  [reference/DISPLAY_HOVER.md](reference/DISPLAY_HOVER.md).

### Backends and generated code

- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables. Edit
  `.slang` and run `pnpm gen:shaders`; CI's `git diff --exit-code` catches stale
  outputs. Consume generated constants by name from TS — never copy a literal
  offset into a renderer. See
  [GPU_RENDERING.md](reference/GPU_RENDERING.md).
- Don't hand-edit a generated markdown block either. Both marker spellings are
  live — `<!-- NAME START -->` and `<!-- BEGIN GENERATED NAME -->` — and `pnpm
  autogen` overwrites the edit at the next run; change the source it scans. See
  [the marker table](#public-developer-guides-mirror-this-spec).
- Don't leave a per-instance vertex budget without the input range it covers.
  Where one instance draws an unbounded number of marks, `verticesPerInstance`
  caps how many the shader can address and the Canvas2D path has no such cap, so
  past the budget the GPU silently drops marks the other backend still draws.
  State the range, measured, beside the number. See
  [GPU_RENDERING.md § Keeping the two backends in parity](reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity).
- Don't diverge the two render backends. Import shader constants into TS rather
  than retyping them, put shared glyph geometry/color math in one draw helper, and
  keep multi-layer order/gating in one exhaustively-keyed registry. And don't go
  the other way: a Canvas2D sub-pixel *overdraw* (fudge factor / `f2`) or
  stroke-vs-fill swap is deliberate AA compensation with no shader equivalent —
  don't port it into a `.slang`. See
  [GPU_RENDERING.md § Keeping the two backends in parity](reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity).

## See also

Deep subsystems, each read on its own task (also linked inline where they come
up). The list is a curated entry set, not the whole shelf —
[reference/README.md](reference/README.md) is the generated index of every
reference doc, and is the right place to look when nothing below matches:

- [reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) — the
  live register of what this architecture *can't* do: the WebGL2 context budget,
  worker stickiness, the couplings we accept, the correctness surfaces no type
  protects. Read before scaling work, or when a symptom smells like a ceiling.
- [reference/GPU_RENDERING.md](reference/GPU_RENDERING.md) — the render lifecycle
  in depth: the mixin, the upload/render autoruns, per-plugin backends, the three
  upload patterns, the HAL, Slang shaders, and the new-display checklist.
- [reference/SHARED_CANVAS_VIEWS.md](reference/SHARED_CANVAS_VIEWS.md) — the
  comparative views (synteny, dotplot): why they own their fetch, how one canvas
  is shared by several displays, and the keying / empty-frame / readiness rules
  that follow. Read before touching either, or before building any container that
  owns a canvas its children draw on.
- [reference/SVG_EXPORT.md](reference/SVG_EXPORT.md) — SVG export pipeline, the
  `svgReady` / `settled` readiness gates, `paintLayer`, model-scoped clip ids.
- [reference/BP_PRECISION.md](reference/BP_PRECISION.md) — the absolute-uint32
  convention, the three coordinate families (LGV bp / window-relative cumBp /
  screen space), hi/lo float math, genome-size limits.
- [reference/PROGRESS_REPORTING.md](reference/PROGRESS_REPORTING.md) — the
  worker→UI status channel, determinate bars, concurrent-fetch aggregation,
  cancel.
- [reference/REGION_TOO_LARGE.md](reference/REGION_TOO_LARGE.md) — the byte/density
  gate: the derived `regionTooLarge` getter, the opt-in hooks, and the shared
  verdict primitives.
- [reference/SYNTENY_LOD.md](reference/SYNTENY_LOD.md) — the two PIF tiers
  (fine/coarse), the profiled cost model, and why read-time binning is capped.
- [reference/HISTORICAL.md](reference/HISTORICAL.md) — the old server-side block
  system, bugs that shaped the current design, corrections to old writeups.
- [reference/GPU_GLOSSARY.md](reference/GPU_GLOSSARY.md) — plain-language GPU
  glossary and a Canvas2D→GPU primer.
- [reference/CONFIG_PATTERN.md](reference/CONFIG_PATTERN.md) — how config reaches
  the renderer (config → MST snapshot → plain object → RPC).
- [reference/DISPLAYCHROME.md](reference/DISPLAYCHROME.md) — the shared
  loading/error/retry chrome every display renders through.
- [reference/DISPLAY_HOVER.md](reference/DISPLAY_HOVER.md) — the four axes that
  invalidate a stored hit, which mixin clears it, and the `hoveredFeature` hook
  every display publishes one through. Read before storing a hover.
- [reference/FETCH_SKELETON.md](reference/FETCH_SKELETON.md) — the one
  latest-wins machine every fetch runs on, what is left per site, and the test
  for which of an autorun's reads are tracked. Read before writing a fetch
  installer or reaching for `untracked`.
- [reference/ROW_HEIGHT_AND_FIT.md](reference/ROW_HEIGHT_AND_FIT.md) — the
  two-valued row-height convention behind `RowHeightMixin`: the `rowHeight` slot
  whose `0` means fit-to-height, and the resolved `effectiveRowHeight` getter that
  is a cross-plugin ABI. Read before adding a row-height or fit-to-height setting.
  Not `HeightModeMixin`, which this line used to name — that one is the *track*
  height's `fixed`/`grow`/`fit` enum, a separate axis.
- [reference/VIEW_INIT.md](reference/VIEW_INIT.md) — the launch state machine
  behind `view.initialized`, which is the precondition `canRender` carries and
  the reason an `afterAttach` must not read view geometry synchronously.
- [reference/NETWORK_ABORT.md](reference/NETWORK_ABORT.md) — where a stop token
  actually reaches the socket: the two mechanisms behind one token, which
  adapters are wired, and the shared-fetch coalescing trap. The other half of
  cancellation from PROGRESS_REPORTING's UI side.
- [reference/CROSS_BACKEND_GATE.md](reference/CROSS_BACKEND_GATE.md) — the
  CI gate behind "don't diverge the two backends": what is in its scope, the
  measured drift behind its threshold, and how to read a failure.
- [mechanisms/draw-pass-registries.md](mechanisms/draw-pass-registries.md) — the
  ordered-id-list-plus-exhaustive-`Record` technique the multi-layer gating rule
  above names, decomposed into the mechanisms it is really made of.
- [reference/DISPLAY_TYPE_DEFAULTS.md](reference/DISPLAY_TYPE_DEFAULTS.md) —
  promotable slots and their CSS-cascade resolution, i.e. the half of [where a
  display's state lives](#where-a-displays-state-lives) that makes a slot
  settable for every track of a type at once. Read before adding a
  make-default-for-all-tracks setting.
- [reference/REFNAME_NAMESPACES.md](reference/REFNAME_NAMESPACES.md) — the
  naming counterpart to [Coordinate system](#coordinate-system): why `refName`
  means two different things either side of the RPC boundary, and which side may
  canonicalize.
- [reference/SHADER_JS_CODEGEN.md](reference/SHADER_JS_CODEGEN.md) — the
  `//! js-export` set that keeps a scalar decision identical in the shader and in
  TS, and how to add one. Read with the "don't diverge the two backends" rule
  above.
- [reference/TEST_INFRASTRUCTURE.md](reference/TEST_INFRASTRUCTURE.md) — browser
  and unit tests, WebGPU CI, and RPC validation. This doc has no testing section;
  that one is it.

