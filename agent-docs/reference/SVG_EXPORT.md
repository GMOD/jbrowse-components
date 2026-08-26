---
name: svg-export
description: SVG export pipeline covering the renderSvg shape, the svgReady/settled readiness gates, paintLayer, and clip ids. Read when touching a display's renderSvg or export readiness.
---

# SVG export pipeline

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Read this when
touching a display's `renderSvg.tsx`, the `svgReady` gate, or the on-screen
capture (`settled`) gate.

The rule that makes it all work: **the GPU shader path is an accelerator; the
Canvas2D draw function is the source of truth, and SVG export runs it.** See
`GPU_RENDERING.md` §"Keeping the two backends in parity".

## Two draw-API shapes

Picked by whether there's a non-trivial builder step between fetched data and
paint:

- **Direct** — `drawXxxBlocks(ctx, regions, blocks, state)` is the only entry
  point; `regions` IS the fetched data (or a 1:1 derived map like
  `laidOutDataMap`). Both the on-screen `Canvas2DXxxRenderer.renderBlocks` and
  `renderSvg.tsx` call it directly.
  Plugins: canvas, MAF, HiC, LD, multi-variant-matrix, sequence, manhattan,
  dotplot.
- **With builder wrapper** — fetched data needs transformation
  (encode/filter/merge) before painting:
  - `drawXxxBlocks(ctx, regions, blocks, state)` paints a pre-built map (the
    on-screen renderer accumulates regions and calls this).
  - `drawXxxToCtx(ctx, sources, blocks, state)` is a one-shot wrapper used by
    `renderSvg.tsx`: it builds the regions map from observable sources, then
    calls `drawXxxBlocks`.
  Plugins: alignments (merge pileup + arcs), wiggle / multi-wiggle (per-region
  encode), multi-variant (Record→Map + filter), multi-LGV-synteny (merge into
  layout map). Alignments exports a named `buildAlignmentsRegionMap` because the
  on-screen `sync(sources)` reuses it.

Per-block-vs-monolithic is an upload/data-shape question (see GPU_RENDERING.md
§"Upload patterns"), **not** a draw-API question. Whether a plugin needs a
`drawXxxToCtx` wrapper depends only on whether there's transformation between raw
data and paint.

All entry points take any 2D-context-shaped surface: a real
`CanvasRenderingContext2D` on-screen, an `SvgCanvas` for vector export.
`Canvas2DXxxRenderer` is bound (canvas required at construction) — SVG export
does **not** instantiate the renderer; it calls the pure functions directly.

Canonical references: builder-wrapper shape →
`plugins/alignments/src/LinearAlignmentsDisplay/renderers/Canvas2DAlignmentsRenderer.ts`
(`buildAlignmentsRegionMap` + `drawAlignmentsToCtx` + `drawAlignmentBlocks`);
direct shape → `plugins/maf/src/LinearMafRenderer/drawMafBlocks.ts`.

## The renderSvg.tsx shape (every LGV display, identical)

**`renderSvg` is optional**, and a display without one is dropped from the export
the way a minimized track is — `notifySkippedSvgTracks`
(`packages/core/src/svg/trackNames.ts`) tells the user which tracks were left
out. So a third-party display that never wrote one costs itself a place in
figures rather than breaking the export for every track in the session. Every
in-tree LGV display has one.

`renderDisplaySvg` (`packages/display-kit/src/renderDisplaySvg.tsx`)
**is** the shape: it awaits readiness (failing the export if the display errored),
resolves the view geometry once, and mounts the terminal-state chrome around the
display's own body. A display writes the body and nothing else.

```tsx
export async function renderSvg(model: RenderSvgModel, opts?: ExportSvgDisplayOptions) {
  return renderDisplaySvg(model, opts, XxxSvgBody)
}

function XxxSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  return (
    <PaintLayer
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={ctx => {
        drawXxxBlocks(ctx, model.rpcDataMap, renderBlocks, state)
        // OR, for multi-source: drawXxxToCtx(ctx, sources, renderBlocks, state)
      }}
    />
  )
}
```

`renderBlocks` comes off the props — the shell resolves
`buildRenderBlocks(view.visibleRegions)` once, for the same reason it resolves
`canvasWidth`. Don't re-derive it in a body.

The body is passed as a **component**, not a callback returning JSX, and that is
load-bearing rather than stylistic: `SvgChrome` renders its terminal box
*instead of* its children, so a body expressed as a component never runs in a
terminal state and no `renderSvg` has to re-detect a terminal from empty or
absent data.

Four invariants hold for **every** GPU display:

- **Readiness and the chrome are the helper's, not yours.** Never re-inline
  `when(() => …)` or mount `SvgChrome` by hand. The duck-typed model interfaces
  each `extends SvgExportable` (`{ svgReady; error; regionTooLarge }`), so a
  missing field is a compile error, not a runtime hang. `awaitSvgReady` fails the
  export on the error terminal and `SvgChrome` draws the other one (an
  `SVGMessageBox` "region too large"), so an over-budget track exports a labeled
  box rather than a silent blank and a failed one exports nothing at all.
- **Paint at `props.canvasWidth`.** See the next section.
- **Render empty naturally — never gate on data size.** The readiness gate and
  `SvgChrome` already own "still loading" and the terminal states, so a
  `size === 0` / `numContacts === 0` check in the body only ever fired for a
  *loaded-but-empty* region, and returning `null` there wrongly dropped a
  legitimate empty render (e.g. alignments' coverage axis). Every draw function
  is empty-safe (self-guards or map-lookup), so the body just draws.
- **Non-LGV displays keep their own wrapper.** `renderDisplaySvg` resolves its
  geometry from a `LinearGenomeViewModel`, so dotplot, synteny and circular still
  call `awaitSvgReady` themselves — and mount the chrome wherever the surface
  they paint is owned (see
  [below](#non-lgv-displays-same-gate-and-svgchrome-wherever-theres-a-box-to-draw)).

### The export canvas width is `view.width`

A display's on-screen `renderState.canvasWidth` is `view.trackWidthPx` —
`view.width` minus the 2px track outline — and that same number is the block
scissor bound handed to `forEachClippedBlock`, plus (for variants) the pixel
snapping origin. The export draws no outline, so reusing it paints the content
2px narrower than the `SvgChrome` frame around it and clips the rightmost
column. `LinearMultiRowFeatureDisplay` shipped that bug; sequence and the regular
multi-sample variant display carried the same shape until the shell took the
decision over.

So `renderDisplaySvg` resolves `canvasWidth = view.width` once and hands it to
the body, and a body reusing `model.renderState` overrides the field:

```tsx
const state = { ...model.renderState, canvasWidth, canvasHeight: height }
```

Two displays legitimately paint at a different width and say so at the seam: the
**variant matrix** (`view.totalWidthPxWithoutBorders` — the content width its
columns, connector lines and hit-test all key off) and **LD** (same, for its
triangle). Both still take the shell's `canvasWidth` for
the frame they draw inside.

### The one permitted body guard: a TypeScript narrow

The only guard a body keeps is a single TS narrow, and it means the same thing
everywhere: `awaitSvgReady` + `SvgChrome` guarantee the data is present and
non-terminal when the body runs, but TS can't see that invariant through the
field's type. **Every such narrow is runtime-unreachable in the export path** —
a type formality, not a loading branch. A body needs one only when it
**destructures fields off a single nullable object**; bodies that iterate the
`rpcDataMap` (an `ObservableMap`) or read individually-guarded getters need none,
because iterating an empty map is already valid.

So "nullable fetch" is not a category a display *is* — it's the shape (single
blob vs per-region map) its fetch happens to take:

- **Single nullable fetch object** — HiC / LD (`if (!rpcData)`), multi-variant /
  multi-variant-matrix (`if (!cellData)`). The monolithic-blob fetch stores
  `null` until the dataset lands, and the body destructures fields off it.
  `svgReady`'s `dataCurrent` disjunct is exactly what makes the `SvgChrome` pass
  (`!error && !regionTooLarge`) imply the object is set. Drop any `&&
  numContacts === 0` size clause — the narrow alone is enough, and even it never
  fires.
- **MAF's `renderState`** is the *same* narrow, not a distinct "still loading"
  category: `renderState` is `undefined` only while `!view.initialized ||
  (!sources && loadedRegions.size === 0)`, and `svgReady` requires
  `loadedRegions.size > 0`, so `if (!state) return null` is unreachable here too.
  (On-screen, the render autorun legitimately sees `undefined` pre-load — a real
  branch there, just not in export.)
- **Sequence** is the genuinely-different case: a *terminal* gate (`if
  (zoomedOut)`) wired through `fetchInert`, not a data narrow.

These narrows stay (rather than being deleted) only because the field is `T |
null` at the type level and can't be made non-nullable without a fake
empty-blob sentinel that would just duplicate `dataCurrent`. Where a getter's
`undefined` came from view-shape alone, it *was* made non-nullable and the guard
deleted:

- **alignments / multi-row-feature** — `renderState` was `undefined` *only*
  pre-`view.initialized`, unreachable at either real reader. Rule of thumb: if a
  `renderState` getter's sole `undefined` trigger is `!view.initialized`, drop
  it and return a value.
- **wiggle / multi-wiggle / manhattan** — `renderState` now always builds: a
  real domain, else an inert `EMPTY_PLOT_DOMAIN` (`[0,1]`) stub so a
  loaded-but-scoreless region still runs `renderBlocks` to clear the canvas +
  flip `canvasDrawn`. Nothing is plotted against the stub and the axis/legend is
  gated on the *real* `domain`, so it never shows a fake scale. This is the one
  place a placeholder domain is unavoidable: the GPU render-state can't be
  constructed without a domain, yet an empty region must still paint (clear).

## The `svgReady` gate (single source of truth for "safe to export")

Every GPU display exposes a `svgReady` getter, and the off-screen renderer
awaits only that — never an inlined `data != null || error || regionTooLarge`.
The inline form resolved on the *first datum* (so multi-region/whole-genome
exports drew a partial viewport) and stayed true through an in-place refetch (so
a pan/zoom export captured stale data). `svgReady` fixes both.

It deliberately **excludes `canvasDrawn`/`painted`** — an off-screen export runs
on a display whose on-screen canvas may never have painted (e.g. headless
jbrowse-img), so gating on the paint flag would hang forever.

**One policy, five predicates.** The formula is single-sourced in
`computeSvgReady(terminals, dataCurrent)` (`@jbrowse/core/svg/svgReady`, beside
`awaitSvgReady`) — the `computeDisplayPhase` treatment applied to export
readiness: `error || regionTooLarge || extraTerminal || fetchCanceled ||
dataCurrent()`, with `dataCurrent` a **thunk** so a display under a banner
doesn't subscribe to the view's `visibleRegions`/`loadedRegions` churn.
`fetchCanceled` is a required terminal because a standing user cancel is a
resting state — durable until Retry or a viewport change, and an export causes
neither — and `awaitSvgReady` then fails the export on it the way it fails on
`error`, so the track is reported rather than written blank (a family with no
cancel affordance, chord, answers it `false`). Every `svgReady` getter in the
tree calls it; what varies is only how that display answers `dataCurrent`, the
one freshness name every foundation exposes. Each of the five hand-written copies
this replaced was a place to forget a terminal (hang the export) or forget
freshness (capture a stale viewport) — both have shipped.

The two LGV foundations don't even call it directly: the *field mapping* onto
`SvgReadyTerminals` was itself the last duplicated copy (both wrote the same four
fields, so a fifth terminal would have had to be remembered twice), and it now
lives in `foundationSvgReady(self)`
(`packages/display-kit/src/foundationSvgReady.ts`). The non-LGV displays name
their terminals differently and keep their own call.

- **`MultiRegionDisplayMixin`** (per-region streamed — canvas, alignments, MAF,
  manhattan, wiggle / multi-wiggle, multi-variant, multi-variant-matrix):
  `dataCurrent` = `viewportWithinLoadedData && loadedRegions.size > 0`. The
  spatial-coverage check waits for *every* visible region (not the first to
  stream in) and goes false the instant a pan/zoom moves the viewport past
  loaded data; `loadedRegions.size` rules out the vacuously-true empty viewport.
  `viewportWithinLoadedData` stays a separate getter — it is the raw coverage
  predicate the fetch autorun and loading overlay use.
  `viewportEmpty` (below) is what keeps that `loadedRegions.size` term from
  hanging an export over a viewport that holds no block to load.
  `fetchInert` is the overridable hook the sequence display uses.
- **`GlobalFetchMixin`** (whole-view single-blob — HiC, LD, and arc): a global
  display has no per-region spatial axis, so it requires the single dataset to
  actually be current — deliberately **not** `displayPhase !== 'loading'`,
  because the fetch trigger is a debounced `afterAttach` autorun, so at export
  time `isLoading` can be false with no data yet, and a `displayPhase !==
  'loading'` test would capture an empty render. `dataCurrent` is **derived**
  here, not a hook: the mixin compares the signature `commitFetchResult` stamped
  against the one the live view calls for, so a display cannot commit without
  stamping and cannot answer freshness by presence. Presence alone (`rpcData !==
  null`) would leave an in-place-refetch gap: a pan/zoom export resolving on the
  pre-pan matrix during the debounce+RPC window, since no global fetch clears
  its payload at refetch start. What a display supplies is `viewSignature`, and
  that one **is** a hook whose default (`undefined`) never fetches and never
  exports: forgetting the override leaves `awaitSvgReady` — an unbounded `when`
  — never returning, which shows up as an export that never finishes rather
  than as a diagnostic. Hung is the deliberate choice there; stale ships wrong
  pixels.

**Both families answer the empty viewport the same way, and neither used to.**
A view holding no content block — every displayed region under
`minimumBlockWidth` and elided, which needs `showAllRegions` over ~270+
similarly-sized regions and so means a scaffold-level assembly — issues no
fetch, so nothing is ever committed and nothing is ever painted. Scrolling
cannot reach it: the view clamps `offsetPx` to the region extent. Both freshness
answers above are false there **permanently**: the per-region one by its
`loadedRegions.size` term, the global one because `prepare` declines on an empty
block list. That is a resting state, so it has to be terminal, and
`viewportEmpty` (`packages/display-kit/src/viewportEmpty.ts`, over the view's own
`hasVisibleContent`) is the term that makes it one — in `foundationSvgReady`'s
freshness thunk rather than as a fourth `SvgReadyTerminals` field, because it is
a view read and the non-LGV callers have no view to answer it from. The same
term feeds `computeLoadingTerm` and `paintInert`, so the three answers a display
gives about being finished cannot disagree. Before it, one track parked off
content hung the whole view's export and sat under a scrim that never lifted.

#### Who answers `dataCurrent` by signature

<!-- BEGIN GENERATED FRESHNESS_SIGNATURE_CENSUS -->


2 models across 2 packages answer `dataCurrent` by comparing the signature their data was loaded for against the one the live view calls for. A display joins by calling `isDataCurrent` and leaves by not calling it.

<!-- prettier-ignore -->
| Model | Loaded signature | Live signature |
| --- | --- | --- |
| `packages/display-kit/src/GlobalFetchMixin.ts` | `self.loadedFetchSignature` | `self.fetchSignature` |
| `packages/synteny-core/src/comparativeFetchFlags.ts` | `self.loadedFetchKey` | `self.currentFetchKey` |
<!-- END GENERATED FRESHNESS_SIGNATURE_CENSUS -->

### The view-level wait: `awaitViewInitialized`

Every view's `renderToSvg` opens with the same wait, and it has the same failure
mode one level up: `view.initialized` folds in the assemblies, so an assembly
that fails to load leaves it false forever and a bare
`when(() => model.initialized)` hangs the export with the dialog spinner up and
nothing said. Use `awaitViewInitialized(model)`
(`@jbrowse/core/svg/svgReady`) — it waits on `initialized || error` and throws
the error when the view never initialized, which surfaces in the dialog's error
banner. Only a view that never initialized is fatal *here*: an errored track on
an initialized view is fatal too, but the displays' own readiness waits report it
after this one has let the export start.

This is why every view's `error` must be **resolved** (fold in assembly errors
and, for the composed views, the sub-views'), not just its raw `volatileError` —
the same rule that makes `showLoading` fall back to the import form instead of
spinning. Every view is on the helper.

A view whose *resting* state draws nothing throws here too rather than saving a
blank canvas: the circular view sitting on its import form has no figure, only
its padding, and used to export a 160px white square.

The **sequence** display adds one extra terminal disjunct — it overrides
`fetchInert` to return `zoomedOut`, because zoomed past its
base-render threshold it shows a static "zoom in" message and issues no fetch,
so `svgReady` alone would never resolve.

### Every resting state that never fetches must be terminal

A correct `dataCurrent` is not sufficient. `dataCurrent` answers "is the held
data current"; it cannot answer "will data ever arrive". So the rule is one
level up: **if a display can sit indefinitely in a state where its fetch trigger
is false, that state has to reach `svgReady` some other way** — `error`,
`regionTooLarge`, `fetchCanceled`, or `fetchInert`. Otherwise one such track
hangs the whole view's export, because `renderToSvg` awaits every display and
`awaitSvgReady`'s only bound is a half-hour backstop (`SVG_READY_TIMEOUT_MS`,
elapsed rather than idle, and picked to sit far past any real export). The cancel is the resting state every
fetching display has: the user parks it, Retry or a viewport change releases
it, and an export does neither — which is why `SvgReadyTerminals` takes it as a
required field rather than leaving it to each display's memory.

Read a global display's `prepare` and ask what leaves it declining forever.
Three shapes have shipped this bug:

- **A user toggle in the gate.** LD's `prepare` returns `undefined` while
  `showLDTriangle` is off, so with the triangle off nothing ever loads. It now
  overrides `fetchInert` to `!showLDTriangle` — the same hook, and
  the same reason, as sequence's `zoomedOut`.
- **A failed prerequisite fetch.** HiC gates on `effectiveResolution`, which
  exists only once a one-shot `CoreGetInfo` lands. That failure used to go to a
  session snackbar, leaving `error` unset — permanent loading scrim, permanently
  unresolved export. A prerequisite whose failure is terminal for the display
  belongs in `setError`, not `notifyError`, so the display gets the shared error
  phase and `svgReady` resolves through it. (And if it's retriable, drive it from
  an autorun on `reloadCounter` so the chrome's retry button re-runs it — a
  `reload()` that only clears the error drops straight back onto the scrim.)
- **The containing view is empty.** The chord display's fetch is gated on
  `view.displayedRegions.length`, and the circular view's menu offers its track
  selector from the import form — so a track opened there never fetched, and the
  export hung with the dialog's spinner up. Its `extraTerminal` is now
  `!view.displayedRegions.length`. The gate need not be on the display: read
  what the fetch autorun *reads*.

### The view geometry is measured after the displays' waits, never before

Same ordering rule as the LGV track heights, for the same reason, and all three
non-LGV views have shipped a violation of it. A `renderToSvg` that destructures
its canvas size out of the model before `await`ing the displays sizes that canvas
for the pre-wait geometry, while the bodies — resolved after — draw against the
post-wait one. The dotplot's plot rect moves with a zoom or a diagonalize
reorder; the circular figure's size, center *and* rotation all move with a zoom
or a drag, and its ruler labels re-read `offsetRadians` for themselves, so a
rotation mid-fetch flipped them upside-down against a wrapper rotated the old
way. Read the geometry on the line after the `Promise.all`.

And a view's *on-screen* padding is not automatically the export's. The circular
view reserves a fixed `paddingPx` gutter for the ruler labels around its circle;
on screen a label that overruns it is clipped by a box the user can resize, but
an export is a standalone artifact, so it takes `max(paddingPx, measured label
width)` — 12-character RefSeq accessions overrun the 80px default and came out
with their tails cut off at the canvas edge. The measurement lives beside the
component that draws the labels (`rulerLabels.ts`, imported by both `Ruler.tsx`
and the export) so the fit test and the room reserved for the labels that fail
it can't disagree.

### Displays outside the two LGV GPU mixins supply their own `dataCurrent`

They don't track `loadedRegions`/`displayPhase` the same way, but they run the
same `computeSvgReady` policy:

- **Arc / paired-arc** are still LGV track displays and compose
  `GlobalFetchMixin`, so they get `svgReady` — and the whole signature compare —
  from it, overriding only `viewSignature` (the static-block keys). Drawing all
  features into a single array (gated by `RegionTooLargeMixin`), the freshness
  compare makes an export fired right after a pan/zoom wait for fresh arcs
  instead of capturing stale ones.
- **Multi-LGV synteny** is *non-LGV* (a `LinearSyntenyView` level composing only
  `BaseDisplay` with its own fetch), so it awaits `awaitSvgReady` itself, calling
  `computeSvgReady` directly with `dataCurrent` =
  `ready && !refetching && dataCurrent` (`ready` = `featureData !== undefined`).
  It needs BOTH freshness terms — `!refetching` covers the in-flight RPC, but a
  debounced fetch (500ms) leaves a *pre-refetch* window where a region/zoom
  change has invalidated the held data yet `fetching` hasn't flipped true, so
  `!refetching` alone still resolves on stale ribbons. `dataCurrent`
  (`loadedFetchKey === currentFetchKey`) closes that window exactly as arc's
  signature does.

  It draws **no `SvgChrome` at all**: every synteny display in a level paints the
  same full-height band, so any box is a box over the siblings that rendered —
  hoisting one `SvgChrome` to `SVGSyntenyLevel` only made it one box that erased
  *every* track's ribbons. A failed ribbon track fails the export instead, from
  the display's own `awaitSvgReady`; `SVGLinearSyntenyView` fans the levels (and
  its genome-view rows) out through `awaitSvgRenders`, so one export names every
  broken track across all of them.

### The shared freshness name, and the shared signature compare

Every display foundation answers one question under one name — **`dataCurrent`**:
does the held data correspond to what is on screen right now? What differs is
only how it is computed, and there are two ways (the third — a viewport-snapshot
compare for the fetch-time-pixel displays — retired 2026-08-21 with the pixel
space itself, when HiC and LD moved to genomic worker output and a signature):

| Mechanism | Foundation | Implementation |
| --- | --- | --- |
| Spatial coverage | `MultiRegionDisplayMixin` | `viewportWithinLoadedData && loadedRegions.size > 0` |
| Signature compare | `GlobalFetchMixin` (arc, HiC, LD), synteny, dotplot | `isDataCurrent(loaded, current)` |

Consumers — `computeSvgReady`, the `settled` capture gates, BreakpointSplitView's
overlays — read `dataCurrent` and never the mechanism, so a display *composes* a
freshness answer rather than choosing which of the names to expose.

`isDataCurrent(loadedSignature, currentSignature)` (`@jbrowse/core/util`,
`loaded !== undefined && loaded === current`) is the shared rule for the second
row. On the LGV global family the whole compare lives on `GlobalFetchMixin`: a
display supplies only `viewSignature` (arc and HiC over static blocks — HiC
appending its binsize — LD over dynamic blocks), the mixin appends the
`rpcPropsCacheKey` settings axis, stamps the issued signature at commit, and
drops it on `reload()`. Dotplot + linear-comparative synteny keep their own
fetch-input signatures (ADR-054); only the final compare is shared with them.

## On-screen capture gate (`settled` → `*_canvas_done`)

`svgReady` gates the off-screen SVG export; a separate gate, `settled`, gates the
on-screen GPU canvas for screenshot capture and browser tests. Dotplot
(`DotplotView.settled` → `dotplot_webgl_canvas_done`) and multi-LGV synteny
(`LinearSyntenyViewHelper.settled` → `synteny_canvas_done`) each expose it: a
testid the capturer waits on so it never snapshots a mid-render frame.

It is `canvasDrawn && !initPending && !pendingAutoDiagonalize &&
displaysSettled(displays)`, where `displaysSettled` (in `synteny-core`'s
`SyntenyFetchStateMixin.ts`, so the two views can't drift) is
`every(!loading && !refetching && dataCurrent)` — the same `dataCurrent`
freshness axis as `svgReady`, for the same reason.
Without it, the debounce gap bites capture harder than export: dotplot's
init-time *autoDiagonalize* reorders the query axis, and for ~1s afterward no
fetch is in flight, so the stale rpcData (absolute-cumBp positions computed for
the OLD order) gets redrawn against the NEW axes — a diagonal-looking hairball —
and `settled` fired on it. This only reproduces on a **cold cache** (the refetch
loses the race with capture); warm reruns hide it, which is why it read as
"flaky per-environment." `dataCurrent` makes the gate honest.

Signatures: `dotplotFetchKey` (lodMode + per-axis bpPerPx + displayed-region
refName/start/end/reversed + the snapped h-axis fetch window); synteny composes
`currentFetchKey` from its
existing tracked-dep getters (`fetchRegionsKey`, `bpPerPxBucketKey`, region
order, CIGAR/marker opts, LOD). The other two terms cover what a fetch
signature cannot see:

- `pendingAutoDiagonalize` — `dataCurrent` catches reordered-but-stale data, but
  a *skipped/errored* diagonalize never reorders at all, so its
  (correctly-fetched, un-diagonalized) data is `dataCurrent`. The flag makes
  `settled` wait for the reorder to actually run, else the capture times out
  loudly rather than commit an un-diagonalized plot.
- `initPending` — before the apply adds them there are no displays to be stale,
  and `every` over none is true, so the gate would open on a cleared canvas. Hit
  once as a fully blank `synteny_canvas_done` frame in CI, where the synteny
  tracks are the last step of a multi-await apply.

### Non-LGV displays: same gate, and no chrome where there's no box

Displays outside the LGV mixins still expose a `svgReady` getter and await it via
the shared `awaitSvgReady` — never an inlined `when()`. Both below run
`computeSvgReady` with `regionTooLarge: false` (neither gates on region size) and
supply their own `dataCurrent` thunk:

- **dotplot**: `!!instanceData && dataCurrent` (which makes it stale-safe,
  matching the capture gate above). `instanceData` rather than `geometry`
  deliberately: the export polls this getter outside any reactive context, where
  reading the `geometry` computed would recompute every segment's color per poll.
  Like synteny it draws no chrome — every dotplot display in a view paints the
  one plot rect, so a box there covers its siblings' dots *and* its own stale
  geometry, which a failed refetch leaves on screen under
  `DisplayStatusOverlays`' `ErrorBanner`. A failed track fails the export
  instead, and `SVGDotplotView` fans the displays out through `awaitSvgRenders`
  so all of them are named.
- **circular chord**: `ready` — a chord fetch covers the whole view at once, so
  "features arrived" is the whole freshness axis. The *on-screen* path keeps a
  bespoke `<DisplayError>` because a radial display has no width/height box to
  host a message rect — which is why the export has nothing sensibly sized to
  draw there either, and draws nothing.

So both halves are uniform across **every** display (LGV, arc, synteny, dotplot,
circular): the readiness gate, and the answer to a failed track — the display
throws, from `awaitSvgReady`. What used to vary, *who* throws, was the
shared-surface exception, and it is gone: a display never has to know whether it
owns the surface it paints, because the reason that mattered — reporting all the
failures rather than the first — is `awaitSvgRenders`' job at the fan-out. Views
use it instead of `Promise.all` and may nest it; failures flatten.

## PaintLayer: raster-vs-vector dispatch

`PaintLayer` (`@jbrowse/core/util/paintLayer`) is a **component**, and it
decides between a 2× DPR raster canvas (when `opts.rasterizeLayers`) and an
`SvgCanvas`, rendering one element (`<image xlinkHref=…>` or
`<g dangerouslySetInnerHTML=…>`). Raster mode bakes the 2× DPR scaling into the
embedded PNG; vector mode serializes the SvgCanvas call log to SVG markup.
Either way the caller draws to `Ctx2D` in CSS pixels — no manual DPR.

**A vector layer whose `paint` drew nothing renders nothing** — not an empty
`<g>`. Layers are routinely conditional on data (a highlight pass with nothing
highlighted, a legend-less track, a band switched off), so a body may mount one
unconditionally rather than duplicating the condition in JSX. This holds through
clipping: `SvgCanvas.clip()` queues its group and only an element actually drawn
commits it, so a painter that walked clipped blocks and drew nothing still
serializes as empty. Omitting `opts` pins a layer to vector even when
`rasterizeLayers` is on — what the canvas feature export does for its label and
peptide overlays, so exported text stays crisp.

**A scale small enough to round to zero must not go in the ctx matrix.**
`wrapSvgExport` serializes every `transform` rounded to 2 decimals, which
`SvgCanvas` is built around — it folds a shape's origin into the translation so
the rounding only perturbs the shape's own width and height. What that leaves
exposed is the *linear* part: a `ctx.scale` below 0.005 rounds to `0`, and the
whole layer exports blank. Hi-C hit it — under absolute coordinates its
`viewScale` is `1 / bpPerPx`, so it crosses that threshold the moment the window
passes ~200 kb and sits around 1e-4 at the megabase windows a contact map is
actually read at, and the exported triangle collapsed while the on-screen canvas
was correct. The fix is the one to reach for generally: a *uniform* scale
commutes with rotation, so multiply it onto the coordinates and leave the ctx
stack holding only O(1) terms (Hi-C keeps the 45° rotation and the fit-to-height
squash there). A bp-derived scale shrinks as the view *widens*, so this is worth
checking first against anything that exports blank only in wide views — the
opposite of where an export bug is usually looked for.

**Avoid hand-rolled JSX-SVG inside `renderSvg.tsx`.** Anything draw-shaped
(rects, paths, fills, strokes) should go through `PaintLayer` so both raster and
vector modes work and the on-screen draw code can be shared. Hand-rolled
`<rect>`/`<path>`/`<line>` inside `renderSvg.tsx` is a red flag — it can't
rasterize, drifts from on-screen output, and locks in vector output.

**Permitted exception classes** (only these — anything else is a regression):

- **Trivial chrome**: scalebars, single separator lines, clipPath wrappers,
  transform `<g>` for offsetting an already-PaintLayer'd block. Use
  `<SvgClipRect>` from `@jbrowse/plugin-linear-genome-view` for the
  clipPath+rect pair.
- **Bezier-arc overlays** (sashimi in `plugins/alignments`, paired arcs in
  `plugins/alignments` and `plugins/arc`): low element count, native SVG
  `<path>` gives hover/tooltip behavior raster can't match. Math comes from a
  shared `computeXxxArcs(opts) → Arc[]` so overlay and export consume identical
  geometry. Don't add a new "vector by design" exception just because something
  is "interactive" — these already render as JSX on-screen, so the JSX path *is*
  the on-screen path.
- **Shared React-SVG overlays** the on-screen view also uses (`VariantLabels`,
  `LinesConnectingMatrixToGenomicPosition`,
  `SvgRowLabels`/`SvgTreePath` from `@jbrowse/tree-sidebar`). Same component
  renders on-screen + in export via an `exportSVG` prop. The heavy
  raster-friendly fill path (the matrix itself) **must** still go through
  `PaintLayer`; only the overlays stay JSX.

Everything else — fills, glyphs, mismatches, coverage bins, score bars, ribbons,
dot lines, sequence text — goes through `<PaintLayer width height opts paint={ctx
=> drawXxx{Blocks,ToCtx}(ctx, …)} />`. This kills the older "SVG-only
`renderToCtx`"
pattern that drifted out of sync with the on-screen renderer (different bicolor
handling, Y-axis offsets, bezier curves, palettes — each plugin had its own
flavor of drift).

**Shared utilities** (`@jbrowse/core/util/`):

- `createSvgRasterCanvas(width, height, opts)` — the 2× DPR canvas +
  `opts.createCanvas` fallback ritual.
- `PaintLayer({ width, height, opts, paint }) → ReactNode` — raster-vs-vector
  dispatch (`@jbrowse/core/util/paintLayer`).
- `SvgExport` — `SvgChrome`/`SVGMessageBox` (the "region too large" terminal) +
  `SvgClipRect` (clipPath wrapper), in `@jbrowse/core/svg/SvgExport`.
- `Ctx2D = CanvasRenderingContext2D | SvgCanvas` — the shared type alias every
  `drawXxxBlocks` signature uses.

## Clip-path ids must be model-scoped

**Every `id` on a `<clipPath>`/`<use>` must be scoped by the owning view or
display model's unique `.id`** — never a bare literal like `"clip-ruler"`, and
never derived only from `trackId`/block key/array index. SVG ids are
document-global: a second `<clipPath id="x">` wins nothing; browsers resolve
every `url(#x)` to the *first* match, so the second clipped group renders
unclipped. This is invisible in isolation and only surfaces once two view panels
land in the same document — synteny rows, breakpoint-split panels.
`exportAndVerifySvg` in `products/jbrowse-web/src/tests/util.tsx` asserts no
duplicate ids as a regression guard; prefer `SvgClipRect` over hand-rolled
`<defs><clipPath>` for new clip ids.

The one sanctioned exception is `SvgCanvas.clip()`
(`packages/core/src/util/SvgCanvas.ts`), which mints ids from a **module-level
counter** (`svgcanvas-clip-${clipIdCounter++}`). It has no model to scope to —
it's the Canvas2D-shim path, driven by imperative `ctx.clip()` calls with no MST
node in scope. Don't "fix" it to use `.id`; do keep new *component*-level clip
ids on `.id`.

Module-level buys uniqueness, which is only half of what an id has to be. The
other half is the one `svgNodeId` exists for — **the same content exports to the
same bytes** — and a counter that runs for the life of the process does not have
it: each export was numbered from wherever the last one stopped. Diffing two
saved SVGs of an unchanged view showed changes that weren't real, and `jest -t`
on any export test but the first failed its checked-in snapshot with a diff that
was nothing but renumbering.

So it is reset per **document**, by `resetSvgClipIds()` in `wrapSvgExport` —
which is the only place that can do it. `wrapSvgExport` is the single funnel
every view's `renderToSvg` ends in, and the `renderToStaticMarkup` it wraps is
synchronous, so a whole document's ids are minted with no other export able to
interleave. Anything resetting on a boundary an `await` can cross would let two
exports share a numbering run and collide. `wrapSvgExport.test.tsx` pins both
halves: export-after-export equality, and distinct ids for the layers of one
document.
