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
  neither: they run a bare fetch autorun over shared parts —
  `SyntenyFetchStateMixin`, `createStopTokenRotation`, `leadingEdgeDebounce`,
  `isDataCurrent`.
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
the Canvas2D path, on-screen and exported pixels can't drift. Arc is the one
non-canvas class *among LGV displays* — it paints JSX `<path>` elements on both
paths (circular view's `ChordVariantDisplay` does the same off this axis
entirely); see [Display stacks](#display-stacks).

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

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally, matching
BED/BAM. Worker output is **absolute genomic uint32** — no regionStart-relative
arithmetic crosses the worker boundary. The precision machinery that makes this
work on a float32 GPU is in [reference/BP_PRECISION.md](reference/BP_PRECISION.md).

## Where a display's state lives

A new setting has three possible homes, and picking wrong fails silently rather
than loudly. Each has its own JSDoc tag and its own generated doc page:

| home | tag | survives a reload? | read/written as |
| --- | --- | --- | --- |
| config slot | `#slot` | yes — in the track config | `getConf` / `resolveConf`, written with `setConf` |
| MST property | `#property` | yes — in the session snapshot, on the display node | `self.x`, written by an action |
| MST volatile | `#volatile` | no | `self.x`, written by an action |

**The slot is the default, and by a wide margin.** Count the tags on a display
and the split is lopsided: `LinearAlignmentsDisplay` has 45 slots and 2
properties, `LinearWiggleDisplay` 6 and 2, `LinearBasicDisplay` 24 and 7 — and
on most displays the surviving properties are just `type` and `configuration`,
the structural minimum MST needs. Nearly every track-menu setting is a slot.

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

Several tables in those guides are **generated**, and so are their counterparts
in this doc — `pnpm autogen` rewrites both from the same scan, so there is no
mirroring step to forget. Don't hand-edit between a `<!-- NAME START -->` /
`<!-- NAME END -->` pair anywhere, here or under `website/docs`:

| Marker | Renders | From |
| --- | --- | --- |
| `DISPLAY_FOUNDATIONS` / `DISPLAY_FOUNDATION_STACKS` | which displays compose which foundation ([Display stacks](#display-stacks)) | the `#displayFoundation` / `#displayFoundationDef` tags, plus each foundation's `types.compose(...)` |
| `CROSS_CUTTING_MIXINS` | which displays compose which cross-cutting mixin ([Cross-cutting mixins](#cross-cutting-mixins-orthogonal-to-the-fetch-foundation)); the same block renders in `creating_display.md` | the `#crossCuttingMixin` tags, plus every `types.compose(...)` in the tree — no consumer-side tag |
| `FETCH_AUTORUNS` | the fetch-lifecycle autoruns ([Data fetching pipeline](#data-fetching-pipeline)) | the install sites in `MultiRegionDisplayMixin.ts` and their `#autorun` tags |
| `PALETTE_KEYS` | the settable theme palette keys | the `Palette` / `StringColors` interfaces |
| `HELPER_PACKAGES` | the standalone npm helper packages | `packages/*/package.json` |
| `REEXPORT_MODULES` | the `@jbrowse/core` subpaths a plugin gets the host's copy of | the `#reexport` comments in `ReExports/list.ts` |

Each of those replaced a hand-written table that had already drifted: the
foundation list claimed a `RegionTooLargeMixin` foundation used by displays
composing no such thing, the autorun table still cleared on a `regionTooLarge`
that had become derived, the palette table was missing a third of its keys, the
package table told plugin authors to bundle four packages that depend on
`@jbrowse/core`, and the re-export table was five paths short while the sentence
above it called the source file the source of truth. A row joins any of them by
existing in the source, never by being written down.

**The pattern worth copying: if a doc sentence tells the reader to go look at a
file, the table under it should be generated from that file.** Every one of
these was a list some author transcribed once and no one re-derived.

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

<!-- prettier-ignore -->
| Foundation (composed on `BaseDisplay`) | Composes | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RegionTooLargeMixin`, `RenderLifecycleMixin`, `FetchMixin` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearReferenceSequenceDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `GlobalDataDisplayMixin()` | `GlobalFetchMixin`, `RenderLifecycleMixin` | `LinearHicDisplay`, `SharedLDModel` |
| `GlobalFetchMixin()` | `RegionTooLargeMixin`, `FetchMixin` | `LinearArcDisplay`, `LinearPairedArcDisplay` |

<!-- DISPLAY_FOUNDATION_STACKS END -->

Read the three rows as: per-region fetch + GPU render; one global dataset +
GPU render; the same global fetch with **no** `RenderLifecycleMixin`, because a
non-GPU display shouldn't drag in the render lifecycle to get
fetch/cancel/too-large/reload. The third is arc, which reaches it through its
own `ArcFetchModel` and paints main-thread SVG. `MultiRegionDisplayMixin` is
also the one row that installs fetch autoruns itself; on the other two each
display installs its own in `afterAttach` via `installGlobalFetchAutorun`.

`GlobalFetchMixin` is the rendering-agnostic fetch foundation shared by the last
two rows: GPU global displays layer `RenderLifecycleMixin` on top of it
(`GlobalDataDisplayMixin`), while arc composes it bare and paints main-thread SVG.
`displayPhase` lives in `GlobalDataDisplayMixin`, not `GlobalFetchMixin`, because
it reads `renderError` — the one genuinely GPU-only piece. `RegionTooLargeMixin`'s
gate is derived and opt-in; arc's `ArcFetchModel` enables it like every other
byte-gated display (see [the region-too-large
gate](#the-region-too-large-gate-summary)).

**The non-LGV views are a third shape, not a row in that table** — deliberately,
and not a migration nobody finished; folding them onto `FetchMixin` was proposed
and rejected in
[ADR-054](architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md),
which is the thing to read before re-proposing it. Both
comparative displays (`LinearSyntenyDisplay`, `DotplotDisplay`) compose
`BaseDisplay` + `SyntenyFetchStateMixin` (`@jbrowse/synteny-core`) and own their
fetch in a bare autorun. Neither gets `FetchMixin`'s cancel/stale machinery,
`RegionTooLargeMixin` or `loadedRegions`; instead the pieces are shared à la
carte — the mixin holds `fetching` / `loadedFetchKey` / `assembliesSwapped` plus
the overridable `fetchInert` hook (see "the on-screen twin" under SVG export),
`createStopTokenRotation` (core) does latest-wins token rotation plus the
`isCurrent()` guard every post-await write is gated on, and the debounce is
`leadingEdgeDebounce`, the same scheduler `installGlobalFetchAutorun` uses.
`installComparativeFetchAutorun` (`@jbrowse/synteny-core`) welds those two
together with the loading/error flags and the refName rename into one skeleton
both displays install, so each supplies only a `prepare` gate (the tracked
reads), a `run` (every await), and a synchronous `commit` the skeleton calls
only while the fetch is still current. The skeleton logs whatever it `setError`s,
so neither display overrides `setError` to log it a second time.
`installAssemblySwapCheck` is the companion installer for the one-shot
reversed-assembly check, off the fetch path — shared for its two `isAlive`
guards (teardown fires the parent atom the gate reads; the RPC resolves long
after a view can be closed), each invisible until a user closes a view
mid-load. They also answer the
shared `dataCurrent` freshness question and run the shared `computeSvgReady`
policy, just via a signature compare (`isDataCurrent` over `dotplotFetchKey` /
synteny's `currentFetchKey`) rather than spatial coverage — which is where the
stale-capture bugs lived
([reference/SVG_EXPORT.md](reference/SVG_EXPORT.md) §"On-screen capture gate").
Both autoruns track the one signature computed (`currentFetchKey`) plus
`adapterConfig`, and read every value behind it `untracked`, so a pan inside the
buffered window can't refire the fetch. The third tracked read is
`SyntenyFetchStateMixin`'s `reloadCounter`, taken **before** `prepare()`'s
bail-outs: after a failure every fetch input is unchanged, so `prepare`
recomputes the same key and nothing refires the autorun — which is why clearing
the error was not enough and the banner's Retry was inert on both views. Same
law, and the same one-line fix, as the global family's `reloadCounter`; see [the
trigger list](#the-global-fetch-trigger-list-must-be-read-unconditionally).
`installComparativeFetchAutorun.test.ts` ("reload() refires the fetch with no
input change") pins it.
Both scope their fetch through the shared `syntenyFetchRegions`
(`@jbrowse/synteny-core`): the visible blocks widened by a pan buffer and
snapped to a buffer-sized grid, so a pan inside the buffer neither refetches nor
exposes an unfetched strip, and the freshness key stays stable across the
gesture. Synteny scopes its query axis, dotplot its h axis; neither scopes the
other axis, because the fetch is one-dimensional in both.

Both put their `RenderLifecycleMixin` *above* the display, so one canvas is
shared by several displays: dotplot on the view itself, synteny on
`LinearSyntenyViewHelper` — the per-level (row-gap) model — so a 3-row stack has
two canvases, one per band, each shared by that level's synteny tracks. That is
what makes their upload callbacks keyed rather than per-region: they diff through
`createKeyedUploadSync` and delete each departed key individually, because an
active-set prune computed from one display's map would wipe its siblings'
buffers.

**A shared canvas is laid out by the model that owns it, never by the displays
drawing on it.** The canvas is absolutely positioned over the whole band, so it
contributes no height; the band has to reserve its own (`level.height` for a
synteny level). Sizing it from the displays instead looks equivalent — every
display in a level reports the level's height — right up to the legal case of a
band with *no* display: an assembly pair with no synteny dataset between it (the
import form launches those deliberately), or the last track on a level hidden.
`LinearComparativeRenderArea` reserved 0px there while its canvas still painted
the level's height, overlapping the genome row below. The SVG export never had
the bug because `SVGLinearSyntenyView` lays its rows out from `level.height`
directly — the on-screen path is the one that has to be told.

**The key is `sharedBackendKey(self.id)` — a hash of the display's node id,
never its index in the parent's list.** An index renumbers the moment a sibling
is hidden or reordered, and then the survivor's key names a slot holding another
display's bytes: the identity diff sees a changed reference and re-uploads every
later display's whole buffer (a full re-pack of every segment), and any frame
that lands between the two draws one display's geometry under another's
parameters. Dotplot keyed by track index until that was fixed.

A shared canvas also makes the **empty frame load-bearing**, and that is why
this family's render callback is *unconditional* where the per-region family's
is gated. When each display owns its canvas, hiding a track unmounts the canvas
with it. When the canvas belongs to the container, nothing else ever repaints
it — so a callback that skips the tick "because no display has geometry" leaves
the hidden track's pixels on screen, its buffer deleted and nothing drawn over
them. Both plugins' backends clear before drawing, so painting zero displays
*is* the wipe. One shape, in both:

- `renderState` is a **resolved getter**, never `undefined`; an empty
  `displayKeys` / `perTrack` is a real frame.
- `canRender` carries the "view isn't measured yet" precondition
  (`view.initialized`), so the autorun pair idles instead of the state going
  nullable.
- `backend.render(state)` returns `void` and always repaints the whole canvas:
  clear, then draw every key it holds geometry for.
- The callback returns `true` — the canvas now reflects the model, which is what
  lets `canvasDrawn`, and so `settled` and the `*_done` testid, resolve on a
  view or level that legitimately has nothing to show.

**Both views publish that `settled` as `data-display-drawn`, a *required* prop on
`RenderCanvas`.** The per-view `synteny_canvas_done` / `dotplot_webgl_canvas_done`
testids still exist and are still what a spec's own `readySelector` names, but the
attribute is what `PENDING_DISPLAYS` (`@jbrowse/browser-test-utils`) waits on, so
these two answer "has everything painted?" with the same attribute every LGV
display does. It is required because the previous version enumerated views by
hand: `PENDING_DISPLAYS` named `synteny_canvas` and simply forgot dotplot, so an
unpainted dotplot counted as finished and a capture could land on it blank — and
a third, hand-copied version of the list lived in the desktop harness, already
stale and matching only by accident. **A readiness signal published as a required
prop cannot forget a view; a selector list can.** Reach for that shape whenever a
cross-cutting check would otherwise be a list someone has to remember to append
to — it is the same move as `fetchInert` being a mixin hook rather than a getter
each display invents.

`canvasDrawn` therefore means "painted at least once" here rather than "real
content reached the canvas" (ADR-009, written for the per-region family, whose
loading scrim reads it through `computeLoadingTerm`'s
`rendersCanvas && !canvasDrawn` term). Nothing is lost: both `settled`
getters carry data-readiness separately through `displaysSettled`, and neither
view drives a scrim off `canvasDrawn`. Dotplot keyed by track index and gated
its render on having geometry until both were fixed; synteny reached the same
place by a different route, with a nullable state and a `clear()` method on the
backend interface for the empty case.

Circular view's `ChordVariantDisplay` is a fourth shape, off this axis
entirely: it paints main-thread JSX SVG (radial, so on screen it keeps a bespoke
`<DisplayError>` instead of `SvgChrome`), composes none of the fetch
foundations, and answers freshness with its own `ready` getter — one chord fetch
covers the whole view, so there is no spatial or signature axis to compare. It
still runs the shared `computeSvgReady` / `awaitSvgReady` export gate
([reference/SVG_EXPORT.md](reference/SVG_EXPORT.md)).

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

<!-- prettier-ignore -->
| Mixin | The display supplies | Composed by |
| --- | --- | --- |
| `TrackHeightMixin()` | Internal vertical scroll. `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks | `LinearAlignmentsDisplay`, `LinearArcDisplay`, `LinearCanvasBaseDisplay`, `LinearHicDisplay`, `LinearMafDisplay`, `LinearManhattanDisplay`, `LinearMultiRowFeatureDisplay`, `LinearPairedArcDisplay`, `LinearReferenceSequenceDisplay`, `LinearScoreDisplay`, `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel` |
| `TreeSidebarMixin()` | Row set with a dendrogram sidebar. `sources` (the display rows, named), plus the `run` callback naming its own clustering RPC. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `runClustering` / `clusterRegion` declarative launch pair `setupRunClusteringAutorun` consumes, the `root` and `willClearTree` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through | `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, `MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel` |
| `HeightModeMixin()` | Track-height strategy; the one row that must compose **after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight` | `LinearAlignmentsDisplay`, `LinearCanvasBaseDisplay` |
| `ScoreScaleMixin()` | Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `*Bound` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume | `LinearAlignmentsDisplay`, `WiggleScoreConfigMixin` |
| `StaleViewportRescaleMixin()` | Stale-pixel rescaling for a display whose worker output is in fetch-time pixel space. Nothing — the display records `lastDrawnOffsetPx`/`lastDrawnBpPerPx` from its render callback. Brings the `renderTransform` that keeps stale pixels aligned during a pan-during-fetch and the `viewportFresh` half of `dataCurrent` | `LinearHicDisplay`, `SharedLDModel` |

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
wiggle's strict-`bpPerPx` `isCacheValid`; whether that is right for a new
subclass is a question the tag table can't answer for you (see "Per-region
zoom-staleness").

Arc is the one display class that draws **neither** GPU canvas nor Canvas2D: its
components emit JSX `<path>` elements, on screen and in SVG export alike. So it
composes no `RenderLifecycleMixin`, and instead of `DisplayChrome` it renders
`DisplayStatusChrome` — the backend-free half `DisplayChrome` itself delegates
to, so its chrome is not merely identical to a GPU display's but the same
component, minus the one phase (`renderError`) that needs a rendering backend to
fail. `features !== undefined || !!error` is its `canvasDrawn`
analogue — the first-paint signal that gates the `-done` testid and the loading
anti-flash. The stricter, staleness-aware `svgReady` is the export gate.

### The global-fetch trigger list must be read unconditionally

`installGlobalFetchAutorun` reads the viewport, `isMinimized`, the
`rpcProps()` cache key (a `computed`, for the reason in "the cache key is the
return value, not the reads") and `reloadCounter` at the top of its body,
*before* the display's `shouldFetch()`
gate, and that ordering is load-bearing. MobX rebuilds the dependency set on
every run, so a read placed inside the gate drops out of it on any run that
decides not to fetch — and can then never wake the autorun again. Arc is the
shape that exposes this: its `shouldFetch` is `!dataCurrent`, so it goes false on
every successful fetch, and with `reloadCounter` read under the gate `reload()`
was silently dead. The display's own `shouldFetch` is the
only gate in the skeleton; each display's `fetch` re-checks `isMinimized` /
`view.initialized` / an empty viewport for its direct callers.

The general rule, which the other fetch autoruns already satisfy: **a gated
trigger read is safe only if the gate is itself an observable that flips on the
transition you want to wake up on.** `if (self.isMinimized) return` above the
tracked deps (synteny, tree-sidebar, the variant sources autorun) is fine —
un-minimizing re-runs the body and re-reads everything. A pure signal like
`reloadCounter`, whose only job is to say "go again" and which no gate consults,
is the dangerous case: nothing else will ever re-run the body on its behalf.
`installGlobalFetchAutorun.test.ts` pins this.

A global display whose `shouldFetch` gates on its own `dataCurrent` must also
invalidate that freshness signal in `reload()` — bumping `reloadCounter` alone
re-runs the autorun but leaves `shouldFetch` false. `ArcFetchModel.reload()`
clears `loadedRegionSignature` for exactly this reason (keeping `features`, so
the stale arcs stay under the loading overlay instead of blanking).

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
alone refires nothing. So all three fetch families now carry the same pure
signal, read unconditionally, each pinned by its installer's test:

| family | installer | the pure signal | pinned by |
| --- | --- | --- | --- |
| per-region | `MultiRegionDisplayMixin`'s `FetchVisibleRegions` | `fetchGeneration` | the mixin's own fetch tests |
| global | `installGlobalFetchAutorun` | `reloadCounter` | `installGlobalFetchAutorun.test.ts` |
| comparative | `installComparativeFetchAutorun` | `SyntenyFetchStateMixin.reloadCounter` | `installComparativeFetchAutorun.test.ts` |

Read the table as the checklist for a fourth: if you add a fetch skeleton with a
gate, it needs a signal the gate never consults, read above the gate, and a test
that fails when the read is deleted.

**Render path is a separate axis.** GPU-canvas vs Canvas2D is chosen per frame at
the backend factory
([GPU_RENDERING.md § RenderingBackend interfaces per plugin](reference/GPU_RENDERING.md#renderingbackend-interfaces-per-plugin)),
not by which foundation a display composes.

## Data fetching pipeline

The public
[data fetching pipeline guide](https://github.com/GMOD/jbrowse-components/blob/main/website/docs/developer_guides/data_fetching.md)
is the tutorial version of this section (the `fetchNeeded` → `fetchEachRegion`
wrapper, `rpcProps`, cancellation, byte gate).

`MultiRegionDisplayMixin` (in
`plugins/linear-genome-view/src/BaseLinearDisplay/`) drives RPC fetches for all
LGV displays (alignments, canvas, wiggle, variants) via these autoruns:

<!-- FETCH_AUTORUNS START -->

`MultiRegionDisplayMixin`'s `afterAttach` installs five autoruns:

<!-- prettier-ignore -->
| Autorun | Fires on | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` changes | `clearAllRpcData()` **+ `clearByteEstimate()`** — one of the two places the cached byte estimate is dropped (the other is a tier swap) |
| `FetchVisibleRegions` | the viewport, or `fetchGeneration` after a fetch ends (debounced 600 ms) | `fetchNeeded(needed)` for the visible blocks loaded data doesn't cover. While `regionTooLarge` holds it runs that same fetch once per settled viewport — the fetch stops at whichever gate rejected it, and there is no measurement-only path. Skipped while `error` / `fetchCanceled` is set, while a fetch is in flight, and while the track is minimized |
| `SettingsInvalidate` | `rpcPropsCacheKey`, the serialized `rpcProps()` return | `clearAllRpcData()`. Installed only when the display defines `rpcProps()` |
| `ClearBlockingStateOnViewportChange` | `view.visibleRegions` | `clearAllRpcData()` when `error` or `fetchCanceled` is set, so the fetch autorun retries. Not `regionTooLarge`, which is derived and re-measured by the fetch autorun itself |
| `ClearHoverOnRegionTooLarge` | `regionTooLarge` becoming true | the overridable `onRegionTooLarge()` hook — a no-op unless the display overrides it |

<!-- FETCH_AUTORUNS END -->

Why the byte estimate is dropped here: `displayedRegionIndex` is reused across
chromosomes, so a stale estimate describes the previous chromosome's numbers and
the banner quotes them at the new region until a re-measure lands. Only that
long — the new region moves `gateViewport.key`, so `gateMeasurementStale` lets
the next fetch through — but a banner quoting the wrong file's cost is worth one
line to avoid. `clearAllRpcData` deliberately leaves the estimate alone (no
flicker on an ordinary clear), which is why the drop lives in the autorun rather
than in that action. This is one of **two** places it is dropped; the other is
`RegionTooLargeMixin`'s own `ClearByteEstimateOnTierSwap`, for a display that
reads a different file at different zooms.

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`.
`fetchRegions` runs an optional pre-flight byte estimate before invoking the work
callback: `RegionTooLargeMixin.byteGateBlocksFetch` → the
`CoreGetRegionByteEstimate` RPC, active when the display sets `measuresBytesPreFlight`
and the shared `gateActive` says something could act on the answer. A blocked
display keeps running that fetch, once per settled viewport, because the
measurement is the only thing that releases the banner and a blocked fetch stops
at it. Oversize regions surface a banner:
`DisplayChrome` renders `TooLargeMessage` from the model's
`regionTooLargeReason`.

The `error`/`fetchCanceled` reads in `ClearBlockingStateOnViewportChange` are
`untracked` for correctness — tracking either would let `set…` re-fire the
autorun and wipe the flag before any viewport change.

Variants are the exception to per-region granularity:
`MultiSampleVariantGetCellData` returns one batched payload covering all visible
regions, so variants' `fetchNeeded` ignores `needed` and derives its own region
set (`fetchRegionsForMode`), marking them all loaded together when the work
callback returns. Which set depends on the mode: regular mode takes
`bufferedVisibleRegions` (off-screen variants simply clip), matrix mode takes
`visibleRegions` only — its columns lay out by feature *index* across the visible
width, so a buffered feature would be crammed into the viewport and draw a
connector to an off-screen position.

### The region-too-large gate (summary)

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It's a **derived** getter on `RegionTooLargeMixin` — a pure function of the last
byte measurement — and what keeps that measurement describing what is on screen
is that a blocked display keeps fetching, once per settled viewport, with the
fetch stopping at the measurement rather than downloading. So the banner releases
on a fresh index read, with no imperative clear and no flicker on pan. Displays
opt in by overriding hooks — `measuresBytesPreFlight` for a pre-flight estimate,
`measuresBytesInFetch` for a byte check inside the display's own feature RPC,
plus `byteGateAdapterConfig` / `densityTooLarge` / `configuredFetchSizeLimit` —
rather than shadowing the getter. **Never override
`gateEnabled`**: it is the OR of the two opt-ins, additive
precisely so a gate mixin can contribute one without racing the base on
composition order, and `CanvasFeatureGateMixin` carries a dev-time check for
that failure because it disables the whole gate silently. Canvas folds
its byte check into the feature-fetch RPC instead of a separate pre-flight
estimate, and adds the density axis, via `CanvasFeatureGateMixin`
(`plugins/canvas/src/shared/`), which both canvas feature displays compose; the
shared verdict/threshold/banner-text primitives live in
`plugins/linear-genome-view/src/shared/regionTooLargeUtils.ts` so the two paths
can't drift.

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
`plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` for the overridable
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

### Sequence-adapter injection is instance-primed and order-dependent

BAM/CRAM decode against the reference (CRAM to reconstruct bases, BAM to compute
mismatches without an MD tag), but a track's adapter config doesn't carry the
reference — it belongs to the assembly. So the assembly's sequence adapter config
rides **alongside** `adapterConfig` as a sibling RPC arg (never spliced into it)
and is stashed on the resolved adapter instance via `setSequenceAdapterConfig`;
the adapter lazily builds it through `getSubAdapter` on first
`getSequenceAdapter()`. Client side, `getSequenceAdapterConfig(assembly)` (in
`assemblyManager/getSequenceAdapterConfig.ts`) produces the snapshot; worker side,
`getFeatureAdapter()` (in `data_adapters/getFeatureAdapter.ts`) is the shared
prologue that resolves the feature adapter and primes it in one step.

The subtlety: **the adapter cache (`dataAdapterCache`) keys on `adapterConfig`
alone, not on the sequence adapter.** So the *first* RPC to resolve a given
adapter primes its sequence config for the lifetime of that cached instance
(`setSequenceAdapterConfig` is set-once). This is why `CoreGetRefNames` — usually
the first call for a track — passes it, and why every reference-needing fetch also
passes it rather than relying on ordering. A fetch that legitimately doesn't need
the reference (e.g. `PileupGetGlobalValueForTag`, which reads BAM tags directly)
omits it.

**Invariant: any feature RPC that decodes against the reference must pass
`sequenceAdapter`.** Don't assume a prior call primed the instance. Note that
`setSequenceAdapterConfig` does **not** propagate through wrapper adapters (there
is no wrapper-over-BAM/CRAM today; if one is reintroduced, plumb inheritance
through `getSubAdapter`).

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
| Three upload patterns / `installPerRegionLifecycle` | Choosing how a display shovels bytes; O(N²) upload bugs |
| HAL / Renderers stay stateless | Touching `packages/render-core/src/hal/` or renderer state |
| Shaders (Slang codegen) | Editing a `.slang` or a generated module |
| Canvas scaling & hi-DPI / `displayedRegionIndex` | Blurry canvases; region↔buffer join keys |
| Adding a new GPU display type | The end-to-end checklist |

### Terminal states early-return their own root

The chrome branches on `model.displayPhase` (`renderError` in
`DisplayChromeBase`, `tooLarge` one level down in `DisplayStatusChromeBase` —
the split is about which banner needs the backend hook's `retry()`, not about
the tree shape, which is identical for both). For either banner it
early-`return`s it as the component's *entire* output,
replacing the display subtree, rather than keeping the container `<div>` mounted
and swapping the banner in beside the canvas. This looks like a leak — the
caller's `className`/`ref`/mouse handlers are absent in those two states — but a
benign one: a too-large region has no canvas to interact with, and the ref
re-attaches on force-load. What makes it the right shape:

- **Clean GPU dispose/re-init.** Early-`return` unmounts the canvas subtree,
  which fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
  `stopRenderingBackend()`; force-load remounts and re-inits via the callback
  ref. Nesting the banner beside a still-mounted canvas would skip that cycle.
  Unmounting is safe precisely because that full dispose→re-init cycle runs.
- **The loading term stays lazy.** `computeDisplayPhase(self, loading)` takes
  `loading` as a thunk and calls it only after ruling out the terminal flags, so
  when a banner is up the chrome's observer tracks only that flag, not the
  view's churning `visibleRegions`/`loadedRegions`.
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
track container's 2px outline under `contain: strict`. Export is the documented
exception to it: the export shell has no outline, so `renderSvg` overrides
`canvasWidth` with the shell's own width (`LgvSvgBodyProps`). The full
contract — the `svgReady`/`settled` freshness gates, the one permitted TypeScript
narrow, `paintLayer`'s raster-vs-vector dispatch, the JSX-SVG exception classes,
and model-scoped clip ids — is in
[reference/SVG_EXPORT.md](reference/SVG_EXPORT.md).

**`awaitSvgReady` has no time bound, so every resting state that never fetches
must be terminal.** A correct `dataCurrent` says whether held data is current; it
cannot say whether data will ever arrive. So read a display's fetch gate and ask
what leaves it false indefinitely — a user toggle inside it (LD's
`showLDTriangle`), an unmet prerequisite (HiC's `shouldFetch` needs an
`effectiveResolution`, which `CoreGetInfo` supplies), a static "zoom in" mode
(sequence). Each such state has to reach `svgReady` through `error`,
`regionTooLarge`, or `svgReadyExtraTerminal`, or one track hangs the whole
view's export with the dialog spinner up and nothing said. Minimized tracks are
the one case already handled for you — `SVGLinearGenomeView` filters them out.

**Enumerate every way the prerequisite fails, not just the throw.** HiC now
`setError`s from `fetchHicInfo`'s `catch` — but a `CoreGetInfo` that *resolves*
carrying no binsize list leaves `effectiveResolution` undefined just as
thoroughly, with no exception to catch, so the empty list needs its own
`setError`. A gate on a fetched value has as many resting states as that value
has empty shapes.

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

**`rpcProps` and `isCacheValid` must live in `.views()`, never `.actions()`.**
MobX runs an action inside `untracked`, so declaring either as an action makes
its reads register no dependency and every caller silently keeps a stale answer
— no error, no crash, and it has regressed twice. That is what
`assertDisplayContract` checks: dev-only, called once per display from whichever
fetch foundation installed its autoruns — `MultiRegionDisplayMixin`'s
`afterAttach` for the per-region family, `installGlobalFetchAutorun` for the
global one — and `console.error` rather than `throw` (an error
escaping `afterAttach` reads as an invalid track and the display is dropped,
hiding the very violation it reports). It also catches a display that wrongly
chains to `super` in its own `afterAttach`, which re-enters the mixin's hook and
installs the fetch autoruns twice.

Their predecessor `renderProps` belonged to the removed server-side block
system and is gone from the tree entirely — it survives only in
[reference/HISTORICAL.md](reference/HISTORICAL.md), so don't reach for it as a
live precedent.

| Method | Consumer | Invalidation route |
| --- | --- | --- |
| `rpcProps()` | `rpcManager.call(..., { ...self.rpcProps(), ... })` — RPC payload | The **serialized** payload, in both families — per-region `SettingsInvalidate` reads `self.rpcPropsCacheKey` → `clearAllRpcData` → refetch; global `installGlobalFetchAutorun` reads a computed over the same function → refetch. See "the cache key is the return value" below |
| `gpuProps()` | `buildSourceRenderData(data, self.gpuProps())` — encoder input | Upload callback reads it — MobX re-uploads without an RPC roundtrip |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap` | Upload autorun reads it — MobX re-uploads without an RPC roundtrip |
| `renderState` | `backend.render(state)` per frame | Render callback reads it — re-fires when deps shift |

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
it into the payload, and `RpcCallArgs` `Omit`s it from the typed args for that
reason. Passing it again in the object is redundant; no call site does anymore.

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
`GlobalDataDisplayMixin` rather than MultiRegion, and both *do* define
`rpcProps()`.

### The cache key is the return value, not the reads

Both families invalidate on the **serialized** payload — never on the raw call —
and `serializeRpcProps` is the one implementation of that. The per-region family
exposes it as the `rpcPropsCacheKey` getter (watched by `SettingsInvalidate`);
`installGlobalFetchAutorun` wraps the same function in a `computed` for its
trigger list.

The reason is that **building the payload reads far more observables than it
returns**, so tracking the call tracks all of them:

- canvas builds it from a whole config snapshot (`getConfigSnapshotWithPromotables`),
  which reads *every* slot on the display config — so a `showLabels`,
  `heightMode` or compact/normal `displayMode` flip, all deliberately excluded
  from the payload, would refetch
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

### `gpuProps()` and derived region maps — re-upload without refetch

`gpuProps()` exists wherever the main thread encodes the GPU buffer — wiggle,
multi-wiggle and MAF (and GC-content, which inherits wiggle's wholesale). HiC and
multi-LGV synteny fill the same role without the method: HiC's upload callback
reads `self.colorScheme` straight into `generateColorRamp`, and synteny's
`computedColors` getter is its re-upload-without-refetch half. Canvas's worker
pre-builds the buffer, so canvas has only `rpcProps()`. This splits refetch from re-upload: wiggle color change →
re-encode only; `bicolorPivot` change → worker output differs → `rpcProps()` →
refetch.

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

**A split that still reaches the packer: the color-lane patch.** A genuine
recolor (`colorBy`, `opacityByIdentity`, a track palette shift) does produce a
fresh `colors` array, and the `geometry` getter then hands the backend a fresh
object over the *same* coordinate arrays — which is exactly what
`createKeyedUploadSync`'s reference diff is meant to catch, but a naive backend
re-packs every lane to change one. So `GpuSyntenyRenderer.getInterleaved` /
`GpuDotplotRenderer.getInterleaved` both memoize the packed bytes on
`(one geometry array's identity, colors' identity)` and call
`patchInstanceColors` when only the latter moved. The GPU re-upload still
happens — the HAL has no partial-buffer update — but the CPU interleave, which
dominates at 10⁵–10⁶ instances, does not. Any new keyed-upload backend whose
palette is a separate main-thread pass wants the same two-line memo.

Derived region maps apply when upload needs whole fresh per-region payloads, not
just encoder parameters. Alignments' `laidOutByGroup` returns, per group, shallow
clones of that group's `rpcDataMap` entries with freshly-allocated Y arrays from
main-thread layout (+ connecting-line / Flatbush in chain mode); `sourceSections`
pairs each with its arc feed and is what the upload callback iterates.
(`laidOutPileupMap` is now just the first group of that map, kept for the
single-section consumers.) Raw `rpcDataMap` is never mutated. Use derived maps
when settings change the shape/contents of per-region data; use `gpuProps()` for
scalars fed to an encoder.

That the raw map is never mutated is also what fixes how it is *represented*:
build it with `regionDataMap()` from
[`installPerRegionLifecycle`](../packages/render-core/src/installPerRegionLifecycle.ts),
which is a **shallow** `observable.map`. An entry that can never change has
nothing for MobX's deep enhancer to observe, so the observable-object graph it
builds per entry on insert — and the proxy hop it adds to every field read — buys
no reactivity at all
([ADR-060](architecture-decision-records/adr-060-region-data-maps-are-shallow-observable.md)).
Every per-region volatile in tree goes through the helper; writing
`observable.map<number, …>()` by hand is the thing to notice in review.

**A derived map is a tier, so keep its cheap half out of its expensive half.**
Alignments splits the one above in two: `laidOutByGroupUncolored` does row
placement, and `laidOutByGroup` bakes the per-read color arrays over it. Nothing
in the color half can move a read's row, so folding the color settings into the
layout computed — which is what `groupLayoutContext` used to do — made a recolor
re-run placement, every per-feature Y remap and the modification Flatbush to
change two arrays. Split, the layout computed stays memoized across a recolor,
and because the overlay *spreads* its input rather than rebuilding it, `readYs`
survives with it: the GPU renderer reads that identity as "same layout run" and
rewrites the read pass alone (GPU_RENDERING.md, "skipping a region inside the
rebuild transaction"). The same reasoning applies to any value a derived map
reads but only *sometimes* spends — the band-overhead input to the grouped fit
budget is a thunk for exactly that reason, so band geometry stays out of the
layout computed's dependency set on the ungrouped path.

### Theme-derived render inputs are session getters, not pushed volatiles

Color palettes are a pure function of the active theme, so derive them in a model
getter — `<plugin builder>(getSession(self).palette)` — that `gpuProps()` /
`renderState` read directly. Do **not** stage them in a volatile that a React
`useEffect` pushes in via a `setColorPalette` action: the effect runs only on
mount, so SVG export and RPC — neither of which has a component — see a null
palette and render blank. As a getter the value is always present and MobX
recomputes it only when the theme changes: same re-encode invalidation, no mount
dependency. The three in tree, each with its own builder over the same session
input: `buildColorPaletteFromPalette` (alignments), `getMafColorPalette` (MAF),
`buildColorPalette` (reference sequence).

**Read `session.palette`, not `session.theme`.** Both are required on
`AbstractSessionModel` and both resolve from the same `resolvePalette` call, so
they cannot disagree — but they are for different consumers, and only one is a
render input:

- `palette` (`JBrowsePalette`) is what *rendering* reads: plain color strings,
  no toolkit, serializable, so it crosses the RPC boundary and works headless.
- `theme` is the resolved MUI `Theme`, for the components that are MUI.

Embedded products without `ThemeManagerSessionMixin` supply both off a
`themeOptions` getter (`EmbeddedSessionThemeMixin`), which is also what the
canvas display puts in `rpcProps()` so worker-baked colors honor the config
`theme` slot. SVG export still overrides the palette with the *export* theme —
`resolvePalette({ configTheme: opts?.theme })`.

## Per-region zoom-staleness

All worker position output is **absolute genomic uint32**, so data stays valid
under zoom. The exceptions are for zoom-dependent *content*, not coords:

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based on
  `bpPerPx / resolution`. `isCacheValid` uses strict equality (`view.bpPerPx ===
  loadedBpPerPx`) — any zoom change refetches all visible regions together. See
  [ADR-008](architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md).
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent worker
  decision. `isCacheValid` returns `false` when `rpcDataMap` has no entry for the
  region, and otherwise refetches only when the viewport crosses
  `shouldRenderPeptideBackground`'s discrete threshold. `laidOutDataMap` uses
  `coarseBpPerPx` (debounced 500ms) so Y-row packing doesn't recompute on every
  animation frame during smooth zoom.
- **MAF**: zoom picks *which fetch runs*, not a resolution — zoomed out with a
  configured summary adapter it pulls cheap per-species summary rows, zoomed in
  the full alignment. Crossing that threshold inside an already-loaded region
  wouldn't move the region bounds, so `isCacheValid` keys on which map holds the
  region (`summaryDataMap` vs `rpcDataMap`).
- **Multi-sample variant matrix**: columns lay out by feature index across the
  visible width, so which features show is a function of the current zoom even
  when the viewport stays spatially inside loaded data. Strict `bpPerPx`
  equality, same rule as wiggle. The *regular* variant display draws each variant
  at its genomic position and keeps the default.

Those are the only four *zoom*-dependent overrides. The rest fall into two other
shapes:

- **Presence alone.** `LinearMultiRowFeatureDisplay` returns
  `rpcDataMap.has(idx)`, so a too-large region — marked loaded but holding no
  data — refetches the moment the gate releases. Canvas folds the same
  presence test in ahead of its peptide-threshold compare.
- **Overriding back to `true`.** `isCacheValid` is inherited, so a display that
  composes a *wiggle* mixin inherits wiggle's strict-`bpPerPx` version whether or
  not its data is zoom-dependent. `LinearManhattanDisplay` is 1:1 with its SNPs
  and doesn't downsample, so it states `return true` outright rather than relying
  on that version short-circuiting on an unset `loadedBpPerPx` — which quietly
  made "never call `setLoadedBpPerPx`" a precondition of correct caching. Check
  what you inherit before leaving the hook alone.

`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override per
region and refetches stale ones.

## What not to do

The index of this doc's rules, meant to be complete: a rule stated anywhere
above gets a line here, so scanning this section is scanning the spec. Each is
stated flat and argued where it's linked; the longer entries kept their
reasoning because it lives nowhere else. Nearly all of them fail *silently* —
that is what makes them worth listing rather than trusting to review.

### State, config and composition

- Don't reach for a new MST property when a config slot would do — the slot is
  the default, and a user's edit persists through `trackConfigDeltas` either
  way. And don't write a slot name onto a *session* display node: that node is
  built by the state model, so the key is dropped in silence. See [where a
  display's state lives](#where-a-displays-state-lives).
- Don't re-implement a cross-cutting mixin's policy in a display. `scrollTop`
  clamping, grow-mode height and the score axis each arrive by overriding one
  hook (see [Cross-cutting
  mixins](#cross-cutting-mixins-orthogonal-to-the-fetch-foundation)); a
  hand-rolled copy is how four displays came to hold four spellings of the same
  scroll clamp.
- Don't compose `HeightModeMixin()` before `TrackHeightMixin()`. It overrides
  that mixin's `height` and `resizeHeight`, and `types.compose` gives the
  collision to the later argument, so the wrong order silently drops grow mode.
  Reported at attach off `supportsHeightModes`, which differs by construction
  where the two `height` getters do not —
  [ordering is the contract](reference/ARCHITECTURAL_LIMITS.md#ordering-is-the-contract).
- Don't chain to `super` in a display's own `afterAttach`. Our MST fork
  auto-chains lifecycle hooks, so calling it installs every fetch autorun twice;
  `assertDisplayContract` reports it in dev. Regular actions still use
  super-capture.

### Fetch

- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()`; it is an infinite fetch loop. See
  [the trap](#rpcprops-loop-trap-and-how-to-break-it).
- Don't declare `rpcProps` or `isCacheValid` in `.actions()`. MST runs an action
  `untracked`, so their reads register no dependency and callers silently keep a
  stale answer; `assertDisplayContract` `console.error`s on it in dev. See
  [the pattern](#rpcprops--gpuprops-pattern).
- Don't put a pure "go again" signal under a fetch gate. `reloadCounter` and
  friends must be read unconditionally, above the bail-outs — a read inside the
  gate drops out of the dependency set on the run that declines, and nothing
  ever wakes the autorun again. All three fetch families carry one; see [the
  trigger list](#the-global-fetch-trigger-list-must-be-read-unconditionally).
- Don't override `fetchNeeded` to return early *without* fetching unless
  something `FetchVisibleRegions` already tracks will wake it. A fetch bumps
  `fetchGeneration`; an early return that skips the fetch breaks that chain and
  must supply its own wake path.
- Don't ship a `rpcProps()` field whose distinct states serialize identically.
  `JSON.stringify` *is* the comparison, so a class without `toJSON` flattens to
  `{}` and an `undefined` drops its key — a silently dead cache axis that raises
  no error. See [the cache key](#the-cache-key-is-the-return-value-not-the-reads).
- Don't let a feature RPC that decodes against the reference omit
  `sequenceAdapter`. `dataAdapterCache` keys on `adapterConfig` alone, so the
  first call to resolve an adapter primes it for that instance's lifetime — don't
  assume a prior call did it.
- Don't override `adapterConfig` to *annotate* it; only to change what the
  adapter is. The cache keys on the config object, so a key the adapter never
  reads still forks the cache into a second instance and a second parse of the
  same file. Pass a worker-side value as a sibling RPC arg instead.
- Don't send row *order* to the worker. A fetch argument may name the row set —
  real work — but the order is a permutation the main thread applies for free,
  and sent unsorted it re-enters the cache key anyway. See [row
  order](#row-order-is-not-a-fetch-input).
- Don't leave `isCacheValid` alone without checking what you inherit. A display
  composing a wiggle mixin gets wiggle's strict-`bpPerPx` version whether or not
  its data is zoom-dependent. See
  [per-region zoom-staleness](#per-region-zoom-staleness).

### Upload and render

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` — it
  belongs in the MST autorun pair spawned by `attachRenderingBackend`.
- Don't destructure model methods; call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't key a shared backend by a list index. Use `sharedBackendKey(self.id)` —
  an index renumbers the moment a sibling is hidden, aliasing one display's
  buffer onto another's slot. See [display stacks](#display-stacks).
- Don't size a shared canvas from the displays drawing on it; the model that
  owns it lays it out. A band with no display is legal, and reserving 0px there
  while the canvas still paints overlaps the row below.
- Don't skip a shared canvas's render tick when there is nothing to draw — an
  empty frame is what erases a hidden track (see "the empty frame is
  load-bearing" above).
- Don't fold a scalar into a per-instance array. If a setting multiplies every
  element by the same number — plot-wide opacity is the case that bit — it
  belongs in the uniform or draw params, not re-packed across every instance.
- Don't fold cheap work into an expensive derived map. Split the tier so a
  recolor doesn't re-run row placement; see [derived region
  maps](#gpuprops-and-derived-region-maps--re-upload-without-refetch).
- Don't make a renderer class the *owner* of per-region data. The model's
  `rpcDataMap` / `laidOutDataMap` is the single source of truth. Most displays
  pass it in per frame (`renderBlocks(blocks, regions, state)`), and that is the
  default to reach for. A renderer-held `private regions` map is legal only when
  it is written **exclusively by the upload callback** and never mutated in
  place: `RenderLifecycleMixin` bumps `renderTick` after every upload, so the
  render autorun re-fires and the cache cannot stale. Alignments is the one
  display built that way (`sync(sources)` on both its GPU and Canvas2D backends,
  because the GPU side must hold buffers anyway and the two share one
  `AlignmentsRenderingBackend` interface). What is still forbidden is a cache
  populated from anywhere else, or one whose entries get patched in place. For
  GPU buffer lifecycle delegate to `hal.pruneRegions(active)`.
- Don't add or redefine volatiles/actions owned by the slot mixin (`canvasDrawn`,
  `renderTick`, `currentRenderingBackend`, `renderError`, `markCanvasDrawn`,
  `resetCanvasDrawn`, `renderNow`, `setRenderError`, `stopRenderingBackend`, etc.).
  `renderError` in particular is the single source for the `renderError` terminal
  phase — don't fork it into a display-local volatile.

### Chrome, readiness and export

- Don't leave a resting state that never fetches non-terminal. `awaitSvgReady`
  has no time bound, so a user toggle, an unmet prerequisite or a static "zoom
  in" mode must reach `svgReady` through `error`, `regionTooLarge` or
  `svgReadyExtraTerminal` — otherwise one track hangs the whole view's export
  with the dialog spinner up. Enumerate every way the prerequisite fails, not
  just the throw. See [SVG export](#svg-export).
- Don't derive the export's terminal set separately from the loading overlay's.
  They are the same states, plus a reader outside the display
  (`displaysSettled`), which is why `fetchInert` is a mixin hook rather than a
  getter each display invents.
- Don't stage theme-derived colors in a volatile that a React `useEffect`
  pushes in. The effect only runs on mount, so SVG export and RPC — neither of
  which has a component — render blank; derive them in a getter. And read
  `session.palette`, not `session.theme`: the palette is the serializable,
  toolkit-free one that crosses the RPC boundary. See [theme-derived render
  inputs](#theme-derived-render-inputs-are-session-getters-not-pushed-volatiles).
- Don't **store** a hover without clearing it on viewport change. Content moves
  under a stationary cursor on three axes — zoom, `offsetPx` (a side-scroll or
  locstring pan fires no pointer event at all), and the display's own
  `scrollTop` — and a sticky canvas gets no `mousemove`/`mouseleave` for any of
  them, so a hover held in a volatile goes on naming what *used* to be there.
  `installClearHoverOnViewportChange` is the fix, and it is a `reaction`
  precisely so its effect can read hover state without setting a hover
  re-firing it. Clearing on `bpPerPx` alone is the same bug with two axes left
  in it, which is where alignments started.

  **A derived hover needs none of this, and that is the other correct design.**
  MAF stores no hit: its body re-runs `mafHitTest` from the live pointer on
  every render, so an observer re-resolves under a moving viewport by
  construction. Store a hover when the hit is expensive or several components
  read it (canvas, alignments, Manhattan, wiggle, the multi-row painting, the
  multi-sample variant matrix); derive it when the hit test is a lookup and one
  component consumes it. What is not allowed is the third thing — storing it and
  leaving the clear to the pointer handlers, which cover only the case where
  the pointer is what moved.

### Backends and generated code

- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables. Edit
  `.slang` and run `pnpm gen:shaders`; CI's `git diff --exit-code` catches stale
  outputs. Consume generated constants by name from TS — never copy a literal
  offset into a renderer.
- Don't diverge the two render backends. Import shader constants into TS rather
  than retyping them, put shared glyph geometry/color math in one draw helper, and
  keep multi-layer order/gating in one exhaustively-keyed registry. And don't go
  the other way: a Canvas2D sub-pixel *overdraw* (fudge factor / `f2`) or
  stroke-vs-fill swap is deliberate AA compensation with no shader equivalent —
  don't port it into a `.slang`. See
  [GPU_RENDERING.md § Keeping the two backends in parity](reference/GPU_RENDERING.md#keeping-the-two-backends-in-parity).

## See also

Deep subsystems, each read on its own task (also linked inline where they come
up):

- [reference/ARCHITECTURAL_LIMITS.md](reference/ARCHITECTURAL_LIMITS.md) — the
  live register of what this architecture *can't* do: the WebGL2 context budget,
  worker stickiness, the couplings we accept, the correctness surfaces no type
  protects. Read before scaling work, or when a symptom smells like a ceiling.
- [reference/GPU_RENDERING.md](reference/GPU_RENDERING.md) — the render lifecycle
  in depth: the mixin, the upload/render autoruns, per-plugin backends, the three
  upload patterns, the HAL, Slang shaders, and the new-display checklist.
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
- [reference/ROW_HEIGHT_AND_FIT.md](reference/ROW_HEIGHT_AND_FIT.md) — the
  two-valued row-height convention behind `HeightModeMixin`: the `rowHeight` slot
  whose `0` means fit-to-height, and the resolved `effectiveRowHeight` getter that
  is a cross-plugin ABI. Read before adding a row-height or fit-to-height setting.
- [reference/VIEW_INIT.md](reference/VIEW_INIT.md) — the launch state machine
  behind `view.initialized`, which is the precondition `canRender` carries and
  the reason an `afterAttach` must not read view geometry synchronously.
- [reference/NETWORK_ABORT.md](reference/NETWORK_ABORT.md) — where a stop token
  actually reaches the socket: the two mechanisms behind one token, which
  adapters are wired, and the shared-fetch coalescing trap. The other half of
  cancellation from PROGRESS_REPORTING's UI side.
- [reference/SHADER_JS_CODEGEN.md](reference/SHADER_JS_CODEGEN.md) — the
  `//! js-export` set that keeps a scalar decision identical in the shader and in
  TS, and how to add one. Read with the "don't diverge the two backends" rule
  above.
- [reference/TEST_INFRASTRUCTURE.md](reference/TEST_INFRASTRUCTURE.md) — browser
  and unit tests, WebGPU CI, and RPC validation. This doc has no testing section;
  that one is it.

