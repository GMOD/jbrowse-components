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
- `DisplayChrome` owns every terminal state — loading, error, render error,
  region-too-large — via the single `displayPhase` getter.
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

`creating_display.md` is the public counterpart of [Display
stacks](#display-stacks) below, and the one guide whose table you must not edit
by hand: its foundation table is regenerated by `pnpm autogen` from the
`#displayFoundation` / `#displayFoundationDef` JSDoc tags on the models
themselves. A display joins it by tagging itself, never by editing prose — the
hand-written version drifted once already, claiming a `RegionTooLargeMixin`
foundation used by displays that compose no such thing.

## Display stacks

Which mixins do you compose to build a display, and why? Linear-genome-view
displays are built from a small set of **foundation mixins** on `BaseDisplay`,
all sharing `baseLinearDisplayConfigSchema` as their config base. Which mixins a
display composes is the primary axis of code sharing; *how* it renders (GPU vs
Canvas2D) is a separate axis layered on top. Two fetch foundations — per-region
(`MultiRegionDisplayMixin`) and single-global (`GlobalFetchMixin`) — cover every
display that lives in an LGV:

The **Displays** column below mirrors the generated table in
`creating_display.md` (see above): that one is built from the `#displayFoundation`
tags and is authoritative for *who composes what*, so add a display by tagging it
and re-running `pnpm autogen`, then mirror it here. The **Brings** column is this
doc's own — it names the composed mixins, which the public table deliberately
states as prose instead. Both list **composers, not inheritors**: a display that
extends another plugin's whole model is covered by whichever model it extends
(see the note after the table).

| Foundation (composed on `BaseDisplay`) | Brings | Displays |
| --- | --- | --- |
| `MultiRegionDisplayMixin()` | `RenderLifecycleMixin` + `FetchMixin` + `RegionTooLargeMixin` + the fetch autoruns + `rpcProps()`→refetch wiring | `LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `LinearManhattanDisplay`, `LinearAlignmentsDisplay`, both multi-sample variant displays, `LinearReferenceSequenceDisplay`, `LinearMafDisplay`, `LinearMultiRowFeatureDisplay`, and via `LinearCanvasBaseDisplay` the `LinearBasicDisplay` / `LinearVariantDisplay` pair |
| `GlobalDataDisplayMixin()` = `GlobalFetchMixin()` + `RenderLifecycleMixin` | the single-global fetch foundation plus GPU render lifecycle and `displayPhase`. No fetch autoruns: each display installs its own `afterAttach` autorun via `installGlobalFetchAutorun` | HiC (`LinearHicDisplay`), LD (`plugins/variants/src/LDDisplay`) |
| `GlobalFetchMixin()` bare (via arc's `ArcFetchModel`) + main-thread SVG render | the same fetch foundation (`RegionTooLargeMixin` + `FetchMixin` + `reloadCounter`) with **no** `RenderLifecycleMixin` — a non-GPU display shouldn't drag in the render lifecycle to get fetch/cancel/too-large/reload | `LinearArcDisplay`, `LinearPairedArcDisplay` |

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
Both autoruns track exactly one signature computed (`currentFetchKey`) plus
`adapterConfig`, and read every value behind it `untracked`, so a pan inside the
buffered window can't refire the fetch.
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

`canvasDrawn` therefore means "painted at least once" here rather than "real
content reached the canvas" (ADR-009, written for the per-region family, whose
loading scrim reads it through `isReady`). Nothing is lost: both `settled`
getters carry data-readiness separately through `displaysSettled`, and neither
view drives a scrim off `canvasDrawn`. Dotplot keyed by track index and gated
its render on having geometry until both were fixed; synteny reached the same
place by a different route, with a nullable state and a `clear()` method on the
backend interface for the empty case.

Circular view's `ChordVariantDisplay` is a fourth shape, off this axis
entirely: it paints main-thread JSX SVG (radial, so it keeps a bespoke
`<DisplayError>` instead of `SvgChrome`), composes none of the fetch
foundations, and answers freshness with its own `ready` getter — one chord fetch
covers the whole view, so there is no spatial or signature axis to compare. It
still runs the shared `computeSvgReady` / `awaitSvgReady` export gate
([reference/SVG_EXPORT.md](reference/SVG_EXPORT.md)).

### Cross-cutting mixins, orthogonal to the fetch foundation

Three concerns cut across the table above, and each is one mixin with one
overridable hook. Composing the mixin *is* the opt-in; a display that doesn't
override the hook pays nothing.

| Concern | Mixin | The display supplies |
| --- | --- | --- |
| Internal vertical scroll | `TrackHeightMixin` | `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks |
| Track-height strategy | `HeightModeMixin` | `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight` |
| Score axis | `ScoreScaleMixin` (`@jbrowse/wiggle-core`) | nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `*Bound` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume |

Each replaced a policy that had been written out per display — four copies of the
scroll clamp, two character-identical copies of grow mode, two implementations of
the score axis. **The interface existed before the implementation in all three
cases** (`ScoreScaleModel`, `installGrowExitBake`'s structural param,
`useVirtualScrollWheel`'s opts), which is the tell worth generalizing: a
duck-typed contract that several displays satisfy by hand is a mixin that hasn't
been written yet.

`HeightModeMixin` must compose **after** `TrackHeightMixin` — it overrides that
mixin's `height` and `resizeHeight`, and `types.compose` resolves a collision to
the later argument. Same hazard as the canvas gate mixin; see [ordering is the
contract](reference/ARCHITECTURAL_LIMITS.md#ordering-is-the-contract-in-five-places).

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
`BaseDisplayComponent` (plugins/arc), which re-uses the shared
`computeDisplayPhase` precedence plus the shared `DisplayErrorBar` /
`DisplayLoadingOverlay` / `TooLargeMessage` so its chrome stays identical to a
GPU display's. `features !== undefined || !!error` is its `canvasDrawn`
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
shape that exposes this: its `shouldFetch` is `!regionTooLarge && !dataCurrent`,
so it goes false on every successful fetch, and with `reloadCounter` read under
the gate `reload()` was silently dead. The display's own `shouldFetch` is the
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

| Autorun | Trigger | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` change | `clearAllRpcData()` **+ `clearByteEstimate()`** — the only place the cached estimate is dropped. `displayedRegionIndex` is reused across chromosomes, so a stale estimate would gate the new region against the previous chromosome's numbers, and since `FetchVisibleRegions` skips while `regionTooLarge` holds, the banner wedges with no refetch to correct it. `clearAllRpcData` deliberately leaves it alone (no flicker on an ordinary clear), which is why the drop lives here and not in that action |
| `FetchVisibleRegions` | viewport / `fetchGeneration` (600ms debounce) | `fetchNeeded(needed)` for uncovered buffered regions; gated by `error`/`regionTooLarge`/`fetchCanceled` and skipped while the track is minimized |
| `SettingsInvalidate` | `rpcProps()` payload change | `clearAllRpcData()` |
| `ClearBlockingStateOnViewportChange` | viewport change while `error` or `fetchCanceled` is set | `clearAllRpcData()` to unblock retry (the derived `regionTooLarge` self-releases, so it's not part of this) |
| `ClearHoverOnRegionTooLarge` | `regionTooLarge` becomes true | fires the overridable `onRegionTooLarge()` hook (no-op base; alignments clears its hover) |

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`.
`fetchRegions` runs an optional pre-flight byte estimate before invoking the work
callback: `RegionTooLargeMixin.byteGateBlocksFetch` → the
`CoreGetRegionByteEstimate` RPC, active when the display sets `byteGateEnabled`
and the shared `gateActive` says something could act on the answer. Oversize regions surface a banner:
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
It's a **derived** getter on `RegionTooLargeMixin` — a pure function of the
cached byte estimate rescaled to the current viewport — so it self-releases on
zoom-in with no imperative clear and doesn't flicker on pan. Displays opt in by
overriding hooks (`derivedRegionTooLargeEnabled`, `configuredFetchSizeLimit`,
`densityTooLarge`) rather than shadowing the getter. Canvas folds
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

`DisplayChrome` branches on `model.displayPhase`. For the `renderError` /
`tooLarge` banners it early-`return`s the banner as its *entire* output,
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
- **React Compiler opt-out.** `DisplayChromeInner` carries `'use no memo'`, so
  babel-plugin-react-compiler doesn't compile it and can't memoize a MobX read on
  `model`'s stable identity. That opt-out is also why `return`-vs-ternary is now
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
awaits `svgReady`, resolves the export geometry, and mounts `SvgChrome` (the
single terminal-state gate) around the display's body component. The body paints
via `paintLayer` at the `canvasWidth` the shell hands it, **not** the
outline-adjusted `renderState.canvasWidth` the on-screen canvas uses. The full
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
MST view methods (not getters), so subclasses extend them via the standard `super`
capture pattern, mirroring `renderProps`.

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

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` — it
  belongs in the MST autorun pair spawned by `attachRenderingBackend`.
- Don't destructure model methods; call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't skip a shared canvas's render tick when there is nothing to draw — an
  empty frame is what erases a hidden track (see "the empty frame is
  load-bearing" above).
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
  `resetCanvasDrawn`, `renderNow`, `setRenderError`, `stopRenderingBackend`, etc.)
  or the `isReady` view owned by `MultiRegionDisplayMixin`. `renderError` in
  particular is the single source for the `renderError` terminal phase — don't fork
  it into a display-local volatile.
- Don't hand-edit `*.generated.ts` or hand-maintain WGSL/GLSL/offset tables. Edit
  `.slang` and run `pnpm gen:shaders`; CI's `git diff --exit-code` catches stale
  outputs. Consume generated constants by name from TS — never copy a literal
  offset into a renderer.
- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps()`; it is an infinite fetch loop. See
  [the trap](#rpcprops-loop-trap-and-how-to-break-it).
- Don't re-implement a cross-cutting mixin's policy in a display. `scrollTop`
  clamping, grow-mode height and the score axis each arrive by overriding one
  hook (see [Cross-cutting
  mixins](#cross-cutting-mixins-orthogonal-to-the-fetch-foundation)); a
  hand-rolled copy is how four displays came to hold four spellings of the same
  scroll clamp.
- Don't clear a hover on `bpPerPx` alone. Content moves under a stationary
  cursor on three axes — zoom, `offsetPx` (a side-scroll or locstring pan fires
  no pointer event at all), and the display's own `scrollTop` — and a sticky
  canvas gets no `mousemove`/`mouseleave` for any of them. Use
  `installClearHoverOnViewportChange`, which is a `reaction` precisely so its
  effect can read hover state without setting a hover re-firing it.
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

