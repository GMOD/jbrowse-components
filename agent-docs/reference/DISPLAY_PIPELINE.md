---
name: display-pipeline
description: How does a display fetch, upload and draw a track — the mixin stacks, the fetch autoruns, rpcProps and gpuProps, the render lifecycle, readiness and SVG export — and which rules there fail silently? Read before touching a display or its data flow.
kind: spec
---

# The display pipeline

The path a track takes from an adapter to pixels, and the rules along it.
[ARCHITECTURE.md](../ARCHITECTURE.md) is the map this sits under; it owns where
a display's state lives (slot, property or volatile), the workspace tiers and
the coordinate system. Every rule here is stated flat in
[What not to do](#what-not-to-do) and argued in a section below or in the
reference doc it links.

## Overview

A **display** is the object that draws one track inside a view — the pileup in
an alignments track, the bars in a wiggle track, the matrix in a Hi-C track. A
worker fetches and parses off the UI thread, the main thread uploads the result
once and then redraws it every frame, and the frame goes through whichever of
three interchangeable backends the runtime picked.

worker: adapter → features (absolute uint32 bp) → RPC → main: `model.rpcDataMap`
(observable) → upload autorun on data change → GPU buffers (HAL: WebGPU → WebGL2
→ Canvas2D) → render autorun on any visible change → `<canvas>`. SVG export
reuses the same Canvas2D draw fn, never the shader.

Every canvas-drawing display **must** provide a Canvas2D draw function; the GPU
shader path is an optional accelerator layered on top. Drawing to a canvas is
itself a choice: circular view's `ChordVariantDisplay` is SVG on both paths.

## Vocabulary

- **Display** — the subject of this doc. Composed from MST mixins that supply
  its behavior: fetch, render lifecycle, height.
- **Backend** — the per-display object that actually draws, GPU or Canvas2D,
  both built by `createMarkBackend` from the display's mark list; the ladder
  picks one at runtime.
- **Region / block** — the visible genome is split into regions
  (`view.displayedRegions`) and finer render blocks; a display fetches and draws
  per region. `displayedRegionIndex` is the join key between the model's data
  map and the GPU buffers.
- **HAL** — hardware abstraction layer; hides the WebGPU-vs-WebGL2 difference.
- **RPC / worker** — the off-thread context where adapters fetch and parse.
- **MST model / autorun** — a display is a `mobx-state-tree` node; `autorun` is
  the MobX primitive that re-runs a function whenever the observables it read
  change.

## What not to do

The index of this doc's rules, complete rather than meant to be: a rule stated
anywhere in this doc gets a line here. Nearly all of them fail *silently*, which
is what makes them worth listing rather than trusting to review. A rule a lint,
type or test already fails on leaves the list, since its message says why.
Every entry links the section or reference doc that argues it —
`website/scripts/check-architecture-checklist.ts` fails one that links nothing
or links a heading a rename took away, and a section this index never points at
is declared in `STATES_NO_RULES`.

### State, config and composition

- Don't add an MST property where a config slot would do, and don't write a slot
  name onto a *session* display node, which drops it. See [where a display's
  state lives](../ARCHITECTURE.md#where-a-displays-state-lives).
- Don't declare a retired setting name anywhere but the config schema's
  `retired` map, the one place all four doors read. See [where a display's
  state lives](../ARCHITECTURE.md#where-a-displays-state-lives).
- Don't re-implement a cross-cutting mixin's policy (scroll clamp, grow-mode
  height, score axis) in a display; override its hook. See [Cross-cutting
  mixins](#cross-cutting-mixins-orthogonal-to-the-fetch-foundation).
- Don't chain to `super` in a display's own `afterAttach`: the MST fork
  auto-chains it, so every fetch autorun installs twice. See [the
  pattern](#rpcprops--gpuprops-pattern).

### Fetch

- Don't put a fetch result (`cellData`, `samplePloidy`) in `rpcProps()`; it
  loops. See [the trap](FETCH_KEYS.md#rpcprops-loop-trap-and-how-to-break-it).
- Don't let a per-frame viewport value reach `gpuProps()`, which re-encodes
  every cached region per frame. See [what each tier
  costs](FETCH_KEYS.md#what-each-tier-costs-when-it-moves-and-who-is-zoom-sensitive).
- Don't read a "go again" signal (`reloadCounter`) under a fetch gate, and don't
  return early from `fetchNeeded` without a wake path. See [the trigger
  list](FETCH_KEYS.md#the-global-fetch-trigger-list-must-be-read-unconditionally).
- Don't give a new fetch installer its first run at the install call, and don't
  leave anything downstream correct only because the fetch is slower. See [the
  fetch skeleton](FETCH_KEYS.md#the-fetch-skeleton-one-latest-wins-machine-one-phase-contract).
- Don't measure bytes anywhere but in the feature RPC (`gateEnabled`,
  `byteLimit`). See [the gate summary](#the-region-too-large-gate-summary).
- Don't build a worker config payload by subtracting from a snapshot; pick the
  slots it reads. See [pick the
  payload](FETCH_KEYS.md#pick-the-payload-out-of-the-snapshot-never-subtract-from-it).
- Don't pass `sequenceAdapter`; name the genome in `assemblyName`. See [the
  reference is part of the adapter's
  identity](#the-reference-is-part-of-the-adapters-identity).
- Don't override `adapterConfig` to annotate it, which forks the adapter cache.
  See [structural args](FETCH_KEYS.md#structural-args-stay-out-of-rpcprops).
- Don't send row order to the worker. See [row
  order](FETCH_KEYS.md#row-order-is-not-a-fetch-input).
- Don't write a `zoomFetchArgs` that reads no observable, spell a second tier as
  a `zoomFetchArgs` field (a coarse tier is `CoarseTierMixin`), or restate the
  zoom tier in a second derivation. See [per-region
  zoom-staleness](FETCH_KEYS.md#per-region-zoom-staleness) and [the hook
  table](DISPLAY_HOOKS.md#display-hooks-and-their-defaults).

### Upload and render

- Don't put upload or render logic in a React effect; it belongs in the autorun
  pair `attachRenderingBackend` spawns. See [GPU
  rendering](#gpu-rendering-architecture).
- Don't destructure model methods, use `useMemo` for observable-dependent
  values, or redefine the slot mixin's volatiles and actions (`canvasDrawn`,
  `renderError` and the rest)
  ([GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md)).
- Don't mutate per-region values in place, fold a scalar into a per-instance
  array, or fold cheap work into an expensive derived map. See [derived region
  maps](FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't build a per-region map with a bare `observable.map`; use
  `regionDataMap()`
  ([ADR-060](../architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
- Don't key a shared backend by a list index, size a shared canvas from its
  displays, or skip its render tick when nothing draws
  ([SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md)).
- Don't make a renderer the owner of per-region data. See [renderers stay
  stateless](GPU_BACKENDS.md#renderers-stay-stateless).

### Chrome, readiness and export

- Don't leave a resting state that never fetches non-terminal: it must reach
  `error`, `regionTooLarge`, `fetchCanceled` or `fetchInert`, the same set the
  loading overlay reads, or the export hangs. See [SVG export](#svg-export).
- Don't ask readiness from a view's raw `bodyMounted`; ask
  `effectiveBodyMounted`. See [VIEW_INIT.md § a nested view's
  `bodyMounted`](VIEW_INIT.md#a-nested-views-bodymounted-reads-true-while-it-is-out-of-the-dom).
- Don't unmount a container's own subtree while it holds a pointer
  measurement. See [terminal
  states](DISPLAYCHROME.md#terminal-states-early-return-their-own-root).
- Don't stage theme-derived colors in a volatile an effect pushes in; derive
  them in a getter over `session.palette`. See [theme-derived render
  inputs](FETCH_KEYS.md#theme-derived-render-inputs-are-session-getters-not-pushed-volatiles).
- Don't store a hover without clearing it on viewport change, or publish it
  under any name but `hoveredFeature`. See [a stored
  hover](#a-stored-hover-is-a-volatile-the-viewport-can-invalidate) and
  [DISPLAY_HOVER.md](DISPLAY_HOVER.md).

### Backends

- Don't diverge the two render backends, port a Canvas2D AA compensation into a
  `.slang`, or leave a per-instance vertex budget without the input range it
  covers. See [keeping the two backends in
  parity](GPU_BACKENDS.md#keeping-the-two-backends-in-parity).

## Display stacks

Linear-genome-view displays are built from a small set of **foundation mixins**
on `BaseDisplay`, all sharing `baseLinearDisplayConfigSchema` as their config
base. Which mixins a display composes is the primary axis of code sharing;
*how* it renders (GPU vs Canvas2D) is a separate axis chosen per frame at the
backend factory
([GPU_BACKENDS.md § RenderingBackend interfaces per plugin](GPU_BACKENDS.md#renderingbackend-interfaces-per-plugin)).

The table is **generated** — both columns. **Displays** comes from the
`#displayFoundation` tags and **Composes** is read off each foundation's own
`types.compose(...)` call. It lists **composers, not inheritors**: a display
that extends another plugin's whole model (`LGVSyntenyDisplay` extends
`LinearAlignmentsDisplay`; the GC-content model extends `LinearWiggleDisplay`;
`LinearBasicDisplay` and `LinearVariantDisplay` extend `LinearFeatureBaseDisplay`)
is covered by the model it extends.

<!-- BEGIN GENERATED DISPLAY_FOUNDATION_STACKS -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Foundation (composed on `BaseDisplay`) | Composes | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `FetchMixin` | `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearMafDisplay`, `LinearMarkDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay` |
| `GlobalFetchMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `KeyedFetchMixin` | `LDTrackDisplay`, `LinearHicDisplay`, `MultiWaySyntenyDisplay` |
| `ComparativeFetchMixin()` | `KeyedFetchMixin` | `DotplotDisplay`, `LinearSyntenyDisplay` |

<!-- END GENERATED DISPLAY_FOUNDATION_STACKS -->

Read the rows as: per-region fetch, one global dataset, and one dataset keyed
on two views and drawn onto a shared canvas. The LGV two bring the render
lifecycle; the comparative one leaves it to the model that owns the canvas. The
first installs its autoruns for every display that composes it — one
`installPerRegionFetchAutoruns(self)` from the mixin's `afterAttach` — while on
the other two each display installs its own via `installGlobalFetchAutorun` /
`installComparativeFetchAutorun`, both declarations over the same
`installFetch` skeleton ([reference/FETCH_KEYS.md](FETCH_KEYS.md)).
The comparative shape — uploads keyed by `sharedBackendKey(self.id)`, an
unconditional repaint, readiness as a required prop — is
[reference/SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md).

Circular view's `ChordVariantDisplay` is a fourth shape, off this axis: it
paints main-thread JSX SVG, composes none of the fetch foundations, and answers
freshness with its own `ready` getter. It still runs the shared
`computeSvgReady` / `awaitSvgReady` export gate and the shared `installFetch`
skeleton.

### Cross-cutting mixins, orthogonal to the fetch foundation

Several concerns cut across the table above, and each is one mixin with one
overridable hook. Composing the mixin *is* the opt-in; a display that doesn't
override the hook pays nothing. The table is **generated** from the
`#crossCuttingMixin` tags, and **Composed by** is read off `types.compose(...)`
directly — a cross-cutting mixin is opt-in, so a display that should have one
and doesn't just quietly does less, and this column is the only place that
shows up. **Read a short row as a question, not a fact.**

<!-- BEGIN GENERATED CROSS_CUTTING_MIXINS -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| Mixin | The display supplies | Composed by |
| --- | --- | --- |
| `TrackHeightMixin()` | Internal vertical scroll. `scrollContentHeight` and `scrollViewportHeight` (both default 0 = doesn't scroll). Brings the derived `scrollableHeight`, the clamped `setScrollTop` and the autorun that re-clamps when content shrinks | `FeatureStaticHost`, `HeightModeMixin`, `LDTrackDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearMarkDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiWaySyntenyDisplay`, `VariantTablesHost`, `WiggleStaticHost` |
| `LegendMixin()` | The legend, whole. A display declares the color scales it paints with (`colorScales`, a getter hook, and `colorScalesIn` where they follow the theme) and the mixin derives the key from them (`legendSpec`, and `legendSpecIn` for the SVG export, through `legendSpecOf`), keeps the `legend.show` slot's getter and setter (`showLegend`, `setShowLegend`), dismisses sections one at a time (`dismissLegendSection`, undone by re-showing the legend), and answers whether there is a key to offer (`hasLegendKey`). `DisplayChrome` draws the on-screen key and the exporting view the exported one, in a gutter right of the plot, so a display places neither | `LDTrackDisplay`, `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearMarkDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay`, `MultiWaySyntenyDisplay`, `WiggleStaticHost` |
| `ColorWritesMixin()` | The writes a display's `encoding.color` channel takes from a menu row or a picker: the field it paints by (`colorByField`) and the constant every feature paints (`setColorValue`). Each rewrites the object as written, so what a pick leaves alone stays as it was, and a pick of what already paints writes nothing, since every color tier keys on the object's arrays. A pick away from a field parks it (`ParkedColorMixin`), so picking it again keeps its domain, range and key names. A dialog's Apply button writes the whole object through `applyPlot`, which rebuilds the display's config for the draft, too dear for a picker writing once per drag frame | `ChordVariantDisplay`, `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `LinearVariantDisplay`, `MatrixRampMixin`, `MultiWaySyntenyDisplay` |
| `ContextMenuMixin()` | The right-click state of a display whose menu acts on a position: the anchor plus whatever the click resolved to (a genomic column, a feature), held as one value so the menu's open-ness and the position its items act on cannot disagree. | `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearMafDisplay`, `LinearMarkDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay`, `MultiWaySyntenyDisplay` |
| `ScoreScaleMixin()` | Value scale, read and written at a `YScalePaths` map's paths (`encoding.y`, the coverage band's `coverage.encoding.y`). `yChannelSchema` / `yFieldChannelSchema`. Brings `ScoreAxisMixin` plus `scaleType` / `scaleZero` / `fenceQuantile` / `clipFenceQuantile` / `symlogConstant` / `manual*` and their setters, i.e. the whole `ScoreScaleModel` interface the Y axis row and its drawer widget consume | `AlignmentsTablesHost`, `LinearAlignmentsDisplay`, `LinearMafDisplay`, `LinearMarkDisplay`, `WiggleScoreConfigMixin` |
| `StoredHoverMixin()` | A stored hover. The hit type, as the type parameter. Brings the `hoveredFeature` getter `BaseDisplay` declares as a hook, `setHoveredFeature`, and the `clearHoveredFeature` the foundations' viewport-change reaction calls | `LinearMafDisplay`, `LinearMarkDisplay`, `LinearScoreDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay` |
| `FacetWritesMixin()` | The writes a display's `facet` object takes from a menu row, a dialog or a chip drag: the field the sections split by (`facetByField`) and their order (`setFacetSort`). Each rewrites the object as written, so what a pick leaves alone stays, and a pick of the field already grouping writes nothing. A display that resets its scroll when the sections change does it from `HiddenGroupsMixin`'s `dropGroupState`, which also runs for a facet an agent, a share link or "Edit plot" writes | `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearMarkDisplay`, `LinearVariantDisplay` |
| `ParkedColorMixin()` | The field the last write took off a color object, with its domain, range and key names, so picking that field again gives them back (`colorForField`), and likewise the fieldless identity scale and its key (`colorForIdentity`). A written field always paints, so the field a write leaves, for Default, Solid color or another field, is display state rather than config. Each writer parks before it writes, so no reader sees the field gone unparked | `ColorWritesMixin`, `LinearWiggleDisplay`, `TrackColorsMixin`, `VariantTablesHost` |
| `TreeSidebarMixin()` | Row set with a dendrogram sidebar, its arrangement and its row colors the display's `rows` config object (`rows.colors` pinned on rows, `rows.color` mapped from an attribute), each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`editableSources`, `clusterableSources`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows`, and `guideTreeNewick` where its adapter has a tree, and overrides the hooks its rows need | `LinearMafDisplay`, `LinearMarkDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay` |
| `HeightModeMixin()` | Track-height strategy over `TrackHeightMixin()`, which it composes and whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the allotted height). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight`, and the grow-exit bake reaction that writes the grown height into the slot when the mode leaves grow | `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearVariantDisplay` |
| `HiddenGroupsMixin()` | The sections a reader hid from an in-track grouping's chips: the `facet.hidden` keys while the stack groups by the facet's field, `hideGroup` and `showAllGroups` writing them, `hiddenGroups` reading them, `groupStateKey` (with the `ownGroupState` hook) for a live figure to key on, and the `dropGroupState` reset that fires when the host's `groupKeySpace` moves | `LinearAlignmentsDisplay`, `LinearFeatureBaseDisplay`, `LinearMarkDisplay` |
| `RowHeightMixin()` | The two-valued row height every scrolling row display has. A `rows.step` (`RowsWithStep`) of px or `"fit"`, and an `autoRowHeight` getter saying what fit divides. Brings the `rowStep` getter, `setRowHeight`, `setFitToHeight`, and the resolved `effectiveRowHeight` every consumer reads | `LinearMarkDisplay`, `LinearVariantDisplay`, `VariantTablesHost` |
| `MatrixRampMixin()` | A matrix display's `encoding.color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), the domain and middle stop it spans over the display's `colorExtent` (`colorDomain`, `colorMidNorm`), all four as the painters read them (`matrixColor`), the legend's ramp (`rampColorScales`), and the scheme pick (`setColorScheme`) through the `ColorWritesMixin` it composes. Under a `threshold` scale the intervals (`colorBins`) paint through a table of one band each, the display handing the painters each value at its interval's centre (`binnedColorValues`), and the key lists the intervals. A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`; one whose values follow the data, rather than a statistic's fixed range, answers `colorExtent` | `LDTrackDisplay`, `LinearHicDisplay` |
| `TriangleMatrixMixin()` | A matrix drawn as a triangle over the view's axis (Hi-C, LD): the fetched payload (`rpcData`), the canvas box (`canvasWidth`, `matrixHeight` under the `matrixTop` hook), the rotate-and-squash transform and its inverse (`cellToScreen`, `screenToCell`), the frame the marks read (`triangleFrame`), the one-cell region map and canvas-wide block the mark backend draws (`matrixRegions`, `matrixBlocks`), and the `heightMode` slot. Composes after `TrackHeightMixin`, `GlobalFetchMixin` and `LegendMixin` | `LDTrackDisplay`, `LinearHicDisplay` |
| `PointerHoverMixin()` | A hover derived from the pointer. The hit type, as the type parameter. Brings the `pointer` volatile, `setPointer` for the chrome's `onPointerPosition`, the `hoverHitAt` hook a display overrides, and the `hoveredFeature` getter `BaseDisplay` declares as a hook | `LinearHicDisplay` |

<!-- END GENERATED CROSS_CUTTING_MIXINS -->

**These tables are source scans because a composed model forgets its parts.**
`types.compose('Name', A, B)` keeps only the final name and a flat list of
initializers, and a display type cannot be created standalone (its
`configuration` needs a tree), so "every display composing mixin X must also Y"
has no runtime walk. Check it with a source-scanning test, the shape
`packages/display-kit/src/reloadReachesCounter.test.ts` uses, or by opening a
live display that throws on the miss.

Each replaced a policy that had been written out per display, and **the
interface existed before the implementation every time** — a duck-typed
contract that several displays satisfy by hand is a mixin that hasn't been
written yet. Look for the contract, not for the duplication.

The third table — which displays override which overridable hooks,
and what sitting on each default costs — is
[reference/DISPLAY_HOOKS.md](DISPLAY_HOOKS.md). Read it before
adding a display: a wrong foundation breaks the display, while every hook has a
default that keeps working and does less.

## A stored hover is a volatile the viewport can invalidate

Four things move or remove content under a stationary cursor with no pointer
event to show for it — zoom, `offsetPx`, the display's own `scrollTop`, and the
`regionTooLarge` banner replacing the subtree — so a hit held in a volatile goes
on naming what used to be there. Both LGV foundations install the clear
(`installClearHoverOnViewportChange`) for their families, and a storer outside
them owes its own (`installClearHoverOnSurfaceMove`, `@jbrowse/core/util`).
Deriving the hit from the live pointer instead, as MAF's tooltip does, needs none of it.
Whichever way, publish it as `hoveredFeature` — `BaseDisplay`'s hook, and what
`LinearGenomeViewContainer` reads to feed `session.hovered`. Which displays
store, which derive, and the axes each installer covers:
[reference/DISPLAY_HOVER.md](DISPLAY_HOVER.md).

## Data fetching pipeline

The public
[data fetching guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
is the tutorial version of this section. `MultiRegionDisplayMixin`
(`packages/display-kit/src/`) drives the per-region family. Its `afterAttach`
is one call to `installPerRegionFetchAutoruns`, which installs these:

<!-- BEGIN GENERATED FETCH_AUTORUNS -->

_Generated by `pnpm autogen` — edit the source, not this block._

`installPerRegionFetchAutoruns` installs four autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` |
| `SettingsInvalidate` | `settingsFetchInputs`, the `rpcProps()` return and the adapter config compared structurally | `invalidateSettings()`: supersede the in-flight fetch, clear a blocking error or cancel, drop settings-baked data. `loadedRegions` stays, so the held data draws under the `staleSettingsDrawn` scrim until the refetch lands |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |
| `FetchVisibleRegions` | the viewport, `fetchGeneration` after a fetch ends, or `reloadCounter` on a user retry (immediate, or debounced 600 ms within 600 ms of the last run) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |

<!-- END GENERATED FETCH_AUTORUNS -->

Every fetch in the tree — those four, the global and comparative installers,
and the prerequisite reads — runs on one latest-wins skeleton, `installFetch`
/ `runFetchOnce` (`@jbrowse/core/util/installFetch`). What the skeleton owns,
which of an autorun's reads are tracked, why every installer's first run is a
microtask, and why every fetch reads a pure "go again" signal above its gates:
[reference/FETCH_KEYS.md](FETCH_KEYS.md#the-fetch-skeleton-one-latest-wins-machine-one-phase-contract). What stales a
region under zoom, and how a coarse tier is a second store rather than a key:
[reference/FETCH_KEYS.md](FETCH_KEYS.md#per-region-zoom-staleness).

### The region-too-large gate (summary)

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It is a **derived** getter on `RegionTooLargeMixin` — a pure function of the
last byte measurement — and a blocked display keeps fetching once per settled
viewport with the fetch stopping at the measurement, so the banner releases on
a fresh index read with no imperative clear. There is one measurement path:
the feature RPC itself measures, so a display opts in with `gateEnabled` and by
passing `byteLimit` in its call, plus `byteGateAdapterPath` / `densityTooLarge`
where a tier or a density axis applies. Canvas adds the density axis via
`FeatureGateMixin`, which `no-restricted-syntax` requires after
`MultiRegionDisplayMixin()`. Full detail:
[reference/REGION_TOO_LARGE.md](REGION_TOO_LARGE.md).

### The reference is part of the adapter's identity

BAM/CRAM, GC content and the reference scans read the reference, but a track's
adapter config doesn't carry it — the assembly does. A call names its genome in
`assemblyName` (a renaming method's regions become that), serialization turns
the name into the assembly's sequence adapter config as a sibling of
`adapterConfig`, and the worker builds a `READS_REFERENCE` adapter with it and
keys the instance on it. **No caller passes it, and nothing sets it later.**
[reference/REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md#the-reference-is-part-of-the-adapters-identity).

## `rpcProps()` / `gpuProps()` pattern

Domain-named methods that enumerate **what affects rendering output**. Both are
MST view methods (not getters), so subclasses extend them via super-capture:

```ts
.views(self => {
  const { rpcProps: superRpcProps } = self
  return {
    rpcProps() {
      return {
        ...superRpcProps(),
        geneticCodeId: self.geneticCodeId,
      }
    },
  }
})
```

| Method | Consumer | Invalidation route |
| --- | --- | --- |
| `rpcProps()` | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | The payload as a **value**, never the call: `settingsFetchInputs` moves — per-region, `SettingsInvalidate` supersedes the fetch; keyed families, `currentFetchKey` moves with it |
| `gpuProps()` | `buildSourceRenderData(data, self.gpuProps())` — encoder input | Upload callback reads it — re-encodes every cached region, main thread, no RPC |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap` | Upload autorun reads it — re-uploads without an RPC roundtrip |
| `renderState` | `backend.render(state)` per frame | Render callback reads it — repaint |

`rpcProps()` returns **user-controlled settings only**. Structural args
(`adapterConfig`, `sequenceAdapter`, `region(s)`, `bpPerPx`, `signal`) are
spread in at the RPC call site, and `sessionId` is the first argument alone.

```ts
rpcManager.call(sessionId, 'RenderXxxData', {
  adapterConfig: self.adapterConfig,  // inherited from BaseDisplayModel
  regions, bpPerPx,                    // per-call values
  ...self.rpcProps(),                  // user settings (cache keys)
  signal, statusCallback,
})
```

The method-shaped fetch hooks live in `.views()`; lint refuses one declared in
`.actions()`, where MobX would run it untracked.

**`assertDisplayContract` is what remains a runtime check**: a display that
wrongly chains to `super` in its own `afterAttach` re-enters the fetch
foundation's hook and installs every autorun twice, and so does composing two
fetch foundations. Dev-only, and `console.error` rather than `throw`. Every
installer calls it once per display; a **secondary** fetch on a display whose
foundation already installed the checks passes no `contract` and skips both.
It lives in `@jbrowse/core`, the lowest tier that can hold it, which is what
lets the comparative installer in `@jbrowse/synteny-core` reach it.

What each tier costs when it moves, why the cache key is the returned value
and not the reads, why a payload is picked from a snapshot and never
subtracted, derived region maps, theme inputs, and the `rpcProps()` loop trap:
[reference/FETCH_KEYS.md](FETCH_KEYS.md).

## GPU rendering architecture

A GPU display composes `RenderLifecycleMixin` and calls
`self.attachRenderingBackend(backend, { upload, render })` in its
`startRenderingBackend(backend)` action. The mixin spawns two autoruns tied to
the model's lifetime: `upload(backend)` pushes bytes to the GPU when the data
changes, `render(backend)` draws a frame when anything visible changes. MobX
auto-tracks every observable read inside each callback. React components are
thin bridges — create a canvas, hand the backend to the model via
`useRenderingBackend` (called inside `DisplayChrome`), render JSX.

The rendering primitives live in **`@jbrowse/render-core`**: the HAL,
`RenderLifecycleMixin`, the backend base classes, the React backend hooks, and
the clip/canvas/hp-math utilities. It is a leaf package (**no**
`@jbrowse/core`), so a third-party display can depend on it directly, and the
host serves it to runtime plugins like every bundled `@jbrowse` package
([ADR-128](../architecture-decision-records/adr-128-the-runtime-abi-is-the-exports-maps.md),
superseding ADR-030's static-import-only rule).

[reference/GPU_RENDERING.md](GPU_RENDERING.md) is the hub; the depth is
in four docs:

| Doc and section | Read when |
| --- | --- |
| [GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md): The core contract | Wiring a new display's render lifecycle |
| GPU_DISPLAY_LIFECYCLE.md: Context-loss recovery | Debugging "why didn't it redraw", context loss, tab visibility |
| GPU_DISPLAY_LIFECYCLE.md: Upload patterns / `installUpload` | Choosing what a display keys its payloads by; O(N²) upload bugs |
| [GPU_BACKENDS.md](GPU_BACKENDS.md): RenderingBackend interfaces per plugin | Declaring a mark list; going Canvas2D-only |
| GPU_BACKENDS.md: Keeping the two backends in parity / Renderers stay stateless | Touching either a `.slang` or a Canvas2D draw fn, or renderer state |
| [GPU_HAL.md](GPU_HAL.md): The HAL / What this architecture deliberately does not have | Touching `packages/render-core/src/hal/`; before proposing a render graph, indirect draws, GPU culling, or SSBOs |
| [GPU_SHADERS.md](GPU_SHADERS.md): Shaders (Slang codegen) / Canvas scaling & hi-DPI | Editing a `.slang` or a generated module; blurry canvases |
| GPU_RENDERING.md: `displayedRegionIndex` / Adding a new GPU display type | Region↔buffer join keys; the end-to-end checklist |

The chrome around the canvas — phase precedence, the retry contract, why a
terminal state early-returns its own root — is
[reference/DISPLAYCHROME.md](DISPLAYCHROME.md).

## SVG export

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Every LGV display's
`renderSvg.tsx` is one call — `renderDisplaySvg(model, opts, XxxSvgBody)` —
which awaits `svgReady` (failing the whole export if that track's data wouldn't
load), resolves the export geometry, and mounts `SvgChrome` around the display's
body component. The body paints via `paintLayer` at the `canvasWidth` the shell
hands it, **not** the on-screen width, which is `MultiRegionDisplayMixin`'s
`canvasWidthPx`.

**`awaitSvgReady`'s only bound is a half-hour backstop, so every resting state
that never fetches must be terminal.** A correct `dataCurrent` says whether
held data is current; it cannot say whether data will ever arrive. Each such
state has to reach `svgReady` through `error`, `regionTooLarge`,
`fetchCanceled` or `fetchInert`, and the loading overlay is terminal on the
same set — `fetchInert` is an overridable hook on `FetchMixin` (default
`false`, the strict answer) because a cross-display reader like
`displaysSettled` can only read a name the mixin declares. The full contract —
the freshness gates, the one permitted TypeScript narrow, `paintLayer`'s
raster-vs-vector dispatch, the JSX-SVG exception classes, model-scoped clip
ids, and the resting-state traps worked one by one — is
[reference/SVG_EXPORT.md](SVG_EXPORT.md).
