# SVG export pipeline

SVG export and on-screen rendering share the same pure Canvas2D draw functions,
so a shader-only tweak can't silently diverge the export. Read this when
touching a display's `renderSvg.tsx`, the `svgReady` gate, or the on-screen
capture (`settled`) gate.

The rule that makes it all work: **the GPU shader path is an accelerator; the
Canvas2D draw function is the source of truth, and SVG export runs it.** See
`ARCHITECTURE.md` §"Keeping the two backends in parity."

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

Per-block-vs-monolithic is an upload/data-shape question (see ARCHITECTURE.md
§"Three upload patterns"), **not** a draw-API question. Whether a plugin needs a
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

## The renderSvg.tsx shape (every display, identical)

An async wrapper that awaits readiness and mounts the error-gated chrome, plus a
sync body that paints. One file learned, all twelve known.

```tsx
export async function renderSvg(model, opts?) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <XxxSvgBody model={model} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function XxxSvgBody({ model, view, height, opts }) {
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  return paintLayer(width, height, opts, ctx => {
    drawXxxBlocks(ctx, model.rpcDataMap, renderBlocks, state)
    // OR, for multi-source: drawXxxToCtx(ctx, sources, renderBlocks, state)
  })
}
```

Three invariants hold for **every** GPU display:

- **Gate the read with `awaitSvgReady(model)`** — the one shared helper,
  re-exported from `@jbrowse/plugin-linear-genome-view`. Never re-inline
  `when(() => …)`. The duck-typed model interfaces each `extends SvgExportable`
  (`{ svgReady; error; regionTooLarge }`), so a missing field is a compile
  error, not a runtime hang.
- **`SvgChrome` is the single terminal-state gate.** Pass it `error` **and**
  `regionTooLarge`; never hand-roll `if (model.error) return …` or infer
  too-large from empty data. It renders the terminal itself (`SVGErrorBox` on
  error, an `SVGMessageBox` "region too large" next) and paints children only
  when there's renderable data, so a body never runs in a terminal state. An
  over-budget or errored track exports a labeled box, not a silent blank.
- **Render empty naturally — never gate on data size.** `awaitSvgReady` +
  `SvgChrome` already own "still loading" and the terminal states, so a
  `size === 0` / `numContacts === 0` check in the body only ever fired for a
  *loaded-but-empty* region, and returning `null` there wrongly dropped a
  legitimate empty render (e.g. alignments' coverage axis). Every draw function
  is empty-safe (self-guards or map-lookup), so the body just draws.

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
  `svgReady`'s `dataLoaded` disjunct is exactly what makes the `SvgChrome` pass
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
  (zoomedOut)`) wired through `svgReadyExtraTerminal`, not a data narrow.

These narrows stay (rather than being deleted) only because the field is `T |
null` at the type level and can't be made non-nullable without a fake
empty-blob sentinel that would just duplicate `dataLoaded`. Where a getter's
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

It deliberately **excludes `canvasDrawn`/`isReady`** — an off-screen export runs
on a display whose on-screen canvas may never have painted (e.g. headless
jbrowse-img), so gating on the paint flag would hang forever.

Two definitions, one per fetch mixin:

- **`MultiRegionDisplayMixin.svgReady`** (per-region streamed — canvas,
  alignments, MAF, manhattan, wiggle / multi-wiggle, multi-variant,
  multi-variant-matrix): `(viewportWithinLoadedData && loadedRegions.size > 0)
  || error || regionTooLarge || svgReadyExtraTerminal`. The spatial-coverage
  check waits for *every* visible region (not the first to stream in) and goes
  false the instant a pan/zoom moves the viewport past loaded data.
  `svgReadyExtraTerminal` is the overridable hook the sequence display uses.
- **`GlobalDataDisplayMixin.svgReady`** (whole-view single-blob — HiC, LD):
  `dataLoaded || error || regionTooLarge || svgReadyExtraTerminal`. A global
  display has no per-region spatial axis, so it requires the single dataset to
  actually be loaded — deliberately **not** `displayPhase !== 'loading'`,
  because the fetch trigger is a debounced `afterAttach` autorun, so at export
  time `isLoading` can be false with no data yet, and a `displayPhase !==
  'loading'` test would capture an empty render. `dataLoaded` is an overridable
  getter (default `false`) each display must implement — the global-display
  analog of `viewportWithinLoadedData`. It carries a **freshness** axis: both
  HiC and LD return `rpcData !== null && viewportMatchesLastDrawn(…)` (comparing
  the `setLastDrawnViewport` snapshot committed alongside `setRpcData` to the
  live `offsetPx`/`bpPerPx`). Presence alone (`rpcData !== null`) would leave an
  in-place-refetch gap: a pan/zoom export resolving on the pre-pan matrix during
  the debounce+RPC window, since neither fetch clears `rpcData` at refetch start.
  A display that forgets to override `dataLoaded` makes `svgReady` unable to
  resolve on a successful load, so `awaitSvgReady` waits out its
  `SVG_READY_TIMEOUT_MS` (60s) and rejects with a diagnostic rather than
  exporting.

The **sequence** display adds one extra terminal disjunct — it overrides
`svgReadyExtraTerminal` to return `zoomedOut`, because zoomed past its
base-render threshold it shows a static "zoom in" message and issues no fetch,
so `svgReady` alone would never resolve.

### Displays outside the two LGV GPU mixins define their own `svgReady`

They don't track `loadedRegions`/`displayPhase` the same way:

- **Arc / paired-arc** are still LGV track displays, so they keep the full
  contract (own `svgReady` getter + `awaitSvgReady` + `SvgChrome`). Drawing all
  features into a single array (gated by `RegionTooLargeMixin`), their `svgReady`
  is `isDataCurrent(loadedRegionSignature, currentRegionSignature(self)) || error
  || regionTooLarge`. The signature freshness compare makes an export fired right
  after a pan/zoom wait for fresh arcs instead of capturing stale ones.
- **Multi-LGV synteny** is *non-LGV* (a `LinearSyntenyView` level composing only
  `BaseDisplay` with its own fetch) yet *rectangular*, so it keeps the shared
  `SvgChrome` + `awaitSvgReady` contract with its own `svgReady`: `(ready &&
  !refetching && dataCurrent) || error` (`ready` = `featureData !== undefined`).
  It needs BOTH freshness terms — `!refetching` covers the in-flight RPC, but a
  debounced fetch (500ms) leaves a *pre-refetch* window where a region/zoom
  change has invalidated the held data yet `fetching` hasn't flipped true, so
  `!refetching` alone still resolves on stale ribbons. `dataCurrent`
  (`loadedFetchKey === currentFetchKey`) closes that window exactly as arc's
  signature does. It has no `regionTooLarge` state, so its `SvgChrome` is passed
  `error` only. **`SvgChrome` is not LGV-specific** — it is the terminal chrome
  for *any* rectangular display, and synteny is the proof.

### The shared freshness predicate

`isDataCurrent(loadedSignature, currentSignature)` (`@jbrowse/core/util`,
`loaded !== undefined && loaded === current`) is the one freshness rule for every
display whose data liveness is a single signature string rather than a
spatial-coverage map — arc / paired-arc (region-key signature), dotplot +
linear-comparative synteny (fetch-input signature). It's the signature-based
analog of the LGV mixins' spatial `viewportWithinLoadedData` and the global
mixins' `viewportMatchesLastDrawn`; the view-specific part (how each builds its
signature) stays per-display, only the final compare is shared. It gates both
`svgReady` (off-screen export) and `settled` (on-screen capture).

## On-screen capture gate (`settled` → `*_canvas_done`)

`svgReady` gates the off-screen SVG export; a separate gate, `settled`, gates the
on-screen GPU canvas for screenshot capture and browser tests. Dotplot
(`DotplotView.settled` → `dotplot_webgl_canvas_done`) and multi-LGV synteny
(`LinearSyntenyViewHelper.settled` → `synteny_canvas_done`) each expose it: a
testid the capturer waits on so it never snapshots a mid-render frame.

It is `canvasDrawn && every display (!loading && !refetching && dataCurrent)` —
the same `dataCurrent` freshness axis as `svgReady`, for the same reason.
Without it, the debounce gap bites capture harder than export: dotplot's
init-time *autoDiagonalize* reorders the query axis, and for ~1s afterward no
fetch is in flight, so the stale rpcData (absolute-cumBp positions computed for
the OLD order) gets redrawn against the NEW axes — a diagonal-looking hairball —
and `settled` fired on it. This only reproduces on a **cold cache** (the refetch
loses the race with capture); warm reruns hide it, which is why it read as
"flaky per-environment." `dataCurrent` makes the gate honest.

Signatures: `dotplotFetchKey` (lodMode + per-axis bpPerPx + displayed-region
refName/start/end/reversed); synteny composes `currentFetchKey` from its
existing tracked-dep getters (`fetchRegionsKey`, `bpPerPxBucketKey`, region
order, CIGAR/marker opts, LOD). Dotplot additionally keeps an
`autoDiagonalizeRequested`/`Complete` pair: `dataCurrent` catches
reordered-but-stale data, but a *skipped/errored* diagonalize never reorders at
all, so its (correctly-fetched, un-diagonalized) data is `dataCurrent` — that
pair makes `settled` wait for the reorder to actually run, else the capture
times out loudly rather than commit an un-diagonalized plot.

### Bespoke error UI, shared gate — no `SvgChrome`

The *non-rectangular* views keep their own error UI (no rectangular width/height
axis to host a message box) but still expose a `svgReady` getter and await it via
the shared `awaitSvgReady` — never an inlined `when()`:

- **dotplot**: `svgReady = (!!geometry && dataCurrent) || !!error`, hand-rolled
  `SVGErrorBox` on a square canvas (`dataCurrent` makes it stale-safe, matching
  the capture gate above).
- **circular chord**: `svgReady = ready || error !== undefined`, renders
  `<DisplayError>`.

So the readiness gate is uniform across **every** display (LGV, arc, synteny,
dotplot, circular) — no `renderSvg` inlines `when()` — while the error chrome
splits: `SvgChrome` for rectangular displays, bespoke for radial/square ones.

## paintLayer: raster-vs-vector dispatch

`paintLayer` (`@jbrowse/core/util/paintLayer`) decides between a 2× DPR raster
canvas (when `opts.rasterizeLayers`) and an `SvgCanvas`, returning one
`ReactNode` (`<image xlinkHref=…>` or `<g dangerouslySetInnerHTML=…>`). Raster
mode bakes the 2× DPR scaling into the embedded PNG; vector mode serializes the
SvgCanvas call log to SVG markup. Either way the caller draws to `Ctx2D` in CSS
pixels — no manual DPR.

**Avoid hand-rolled JSX-SVG inside `renderSvg.tsx`.** Anything draw-shaped
(rects, paths, fills, strokes) should go through `paintLayer` so both raster and
vector modes work and the on-screen draw code can be shared. Hand-rolled
`<rect>`/`<path>`/`<line>` inside `renderSvg.tsx` is a red flag — it can't
rasterize, drifts from on-screen output, and locks in vector output.

**Permitted exception classes** (only these — anything else is a regression):

- **Trivial chrome**: scalebars, single separator lines, clipPath wrappers,
  transform `<g>` for offsetting an already-paintLayer'd block. Use
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
  `LinesConnectingMatrixToGenomicPosition`, `RecombinationTrack`,
  `SvgRowLabels`/`SvgTreePath` from `@jbrowse/tree-sidebar`). Same component
  renders on-screen + in export via an `exportSVG` prop. The heavy
  raster-friendly fill path (the matrix itself) **must** still go through
  `paintLayer`; only the overlays stay JSX.

Everything else — fills, glyphs, mismatches, coverage bins, score bars, ribbons,
dot lines, sequence text — goes through `paintLayer(width, height, opts, ctx =>
drawXxx{Blocks,ToCtx}(ctx, …))`. This kills the older "SVG-only `renderToCtx`"
pattern that drifted out of sync with the on-screen renderer (different bicolor
handling, Y-axis offsets, bezier curves, palettes — each plugin had its own
flavor of drift).

**Shared utilities** (`@jbrowse/core/util/`):

- `createSvgRasterCanvas(width, height, opts)` — the 2× DPR canvas +
  `opts.createCanvas` fallback ritual.
- `paintLayer(width, height, opts, paint) → ReactNode` — raster-vs-vector
  dispatch.
- `svgExport` — `SVGErrorBox` (red error banner) + `SvgClipRect` (clipPath
  wrapper).
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
counter** (`svgcanvas-clip-${clipIdCounter++}`). It's safe — a process-global
monotonic counter is unique across every canvas and export in the document — and
it has no model to scope to (it's the Canvas2D-shim path, driven by imperative
`ctx.clip()` calls with no MST node in scope). Don't "fix" it to use `.id`; do
keep new *component*-level clip ids on `.id`.
