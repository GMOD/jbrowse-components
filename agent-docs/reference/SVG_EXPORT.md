---
name: svg-export
description: SVG export pipeline covering the renderSvg shape, the svgReady/settled readiness gates, paintLayer, and clip ids. Read when touching a display's renderSvg or export readiness.
kind: spec
---

# SVG export pipeline

SVG export and on-screen rendering share the same pure Canvas2D draw functions.
**The GPU shader path is an accelerator; the Canvas2D draw function is the
source of truth, and SVG export runs it.** See `GPU_BACKENDS.md` §"Keeping the
two backends in parity".

## Two draw-API shapes

- **Direct** — `drawXxxBlocks(ctx, regions, blocks, state)` is the only entry
  point; `regions` is the fetched data or a 1:1 derived map. The on-screen
  `Canvas2DXxxRenderer.renderBlocks` and `renderSvg.tsx` both call it.
- **With builder wrapper** — fetched data needs encode/filter/merge first.
  `drawXxxBlocks` paints a pre-built map; `drawXxxToCtx(ctx, sources, blocks,
  state)` builds the map from observable sources for `renderSvg.tsx`.

A plugin needs a `drawXxxToCtx` wrapper only when data is transformed between
fetch and paint, not because of per-block versus monolithic upload. Reference
shapes: `Canvas2DAlignmentsRenderer.ts` (builder) and
`plugins/maf/src/LinearMafDisplay/renderSvg.tsx` (direct, via
`paintMarkBlocks`).

Every entry point takes any 2D-context-shaped surface: a real
`CanvasRenderingContext2D` on screen, an `SvgCanvas` for export. SVG export never
instantiates a Canvas2D backend (it requires a canvas at construction).

## The renderSvg.tsx shape (every LGV display)

`renderSvg` is optional. A display without one is dropped from the export like a
minimized track, and `notifySkippedSvgTracks`
(`packages/core/src/svg/trackNames.ts`) names it.

`renderDisplaySvg` (`packages/display-kit/src/renderDisplaySvg.tsx`) is the
shape: it awaits readiness (failing the export if the display errored), resolves
view geometry once, and mounts terminal-state chrome around the display's body.
A display writes only the body:

```tsx
export async function renderSvg(model: RenderSvgModel, opts?: ExportSvgDisplayOptions) {
  return renderDisplaySvg(model, opts, XxxSvgBody)
}

function XxxSvgBody({ model, height, canvasWidth, renderBlocks, opts }: LgvSvgBodyProps<RenderSvgModel>) {
  return (
    <PaintLayer
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={ctx => drawXxxBlocks(ctx, model.rpcDataMap, renderBlocks, state)}
    />
  )
}
```

- The shell clips the body to `view.width × height` under
  `display-clip-<node id>`, with axes and legend outside the clip. A body adds a
  clip only for a box narrower than the display's.
- `renderBlocks` and `canvasWidth` come off the props; a body never re-derives
  them.
- The body is a **component**, not a callback returning JSX: `SvgChrome` renders
  its terminal box instead of its children, so the body never runs in a terminal
  state and never re-detects one from empty data.
- `overlays` is false under `plotOnly` (the circular view's ring export). The
  ring samples the display's canvas alone, so a body drops labels, trees, arcs
  and other overlays the screen draws over it.
- Never re-inline `when(() => …)` or mount `SvgChrome` by hand. Duck-typed model
  interfaces `extends SvgExportable` (`{ svgReady; error; regionTooLarge }`), so a
  missing field fails the build. `awaitSvgReady` fails the export on `error`;
  `SvgChrome` draws the "region too large" box.
- Render empty naturally. Never gate a body on data size: it only fires for a
  loaded-but-empty region and wrongly drops a legitimate empty render. Draw
  functions are empty-safe.
- Non-LGV displays (dotplot, synteny, circular) keep their own wrapper and call
  `awaitSvgReady` themselves.

### The export canvas width is `view.width`

On screen `renderState.canvasWidth` is `view.trackWidthPx` (`view.width` minus
the 2px outline). The export draws no outline, so reusing it paints content 2px
narrower than the `SvgChrome` frame and clips the last column.
`renderDisplaySvg` hands the body `canvasWidth = view.width`; a body reusing
`model.renderState` overrides the field:

```tsx
const state = { ...model.renderState, canvasWidth, canvasHeight: height }
```

The variant matrix and LD paint at `view.totalWidthPxWithoutBorders` (the content
width their columns and hit-test key off) and still take the shell's
`canvasWidth` for the frame.

### The one permitted body guard: a TypeScript narrow

`awaitSvgReady` plus `SvgChrome` guarantee the data is present when the body
runs, but TS cannot see that through a `T | null` field. A body needs a narrow
only when it destructures fields off a single nullable object (HiC and LD
`rpcData`, multi-variant `cellData`, MAF's `renderState`). Every such narrow is
runtime-unreachable in export. Bodies that iterate an `ObservableMap` need none.

When a `renderState` getter's only `undefined` trigger is `!view.initialized`,
make it non-nullable and drop the guard. Wiggle and manhattan always build a
`renderState`, falling back to an inert `EMPTY_PLOT_DOMAIN` so a scoreless region
still clears the canvas; the axis and legend gate on the real `domain`.

## The `svgReady` gate

Every GPU display exposes `svgReady`, and the off-screen renderer awaits only
that. An inlined `data != null || error || regionTooLarge` resolves on the first
datum (partial multi-region export) and stays true through an in-place refetch
(stale pan/zoom export).

`svgReady` excludes `canvasDrawn`: an off-screen export runs on a display whose
canvas may never have painted (headless jbrowse-img), so gating on the paint flag
hangs forever.

`computeSvgReady(terminals, dataCurrent)` (`@jbrowse/core/svg/svgReady`) is the
one formula: `error || regionTooLarge || extraTerminal || fetchCanceled ||
dataCurrent()`. `dataCurrent` is a thunk so a banner-covered display does not
subscribe to view churn. `fetchCanceled` is a required terminal: a user cancel is
a resting state that an export never releases, and `awaitSvgReady` fails the
export on it as it does on `error`. Every `svgReady` getter calls it;
`foundationSvgReady(self)` (`packages/display-kit/src/foundationSvgReady.ts`)
holds the field mapping for the two LGV foundations.

- **`MultiRegionDisplayMixin`** (canvas, alignments, MAF, manhattan, wiggle,
  multi-variant, multi-variant-matrix): `dataCurrent` is
  `viewportWithinLoadedData && loadedRegions.size > 0`. It waits for every
  visible region and goes false the instant a pan or zoom leaves loaded data.
  `fetchInert` is the overridable hook the sequence display uses.
- **`GlobalFetchMixin`** (HiC, LD): `dataCurrent` compares the signature
  `commitFetchResult` stamped against the one the live view calls for. Presence
  alone (`rpcData !== null`) leaves a gap where a pan/zoom export resolves on the
  pre-pan matrix; `displayPhase !== 'loading'` captures an empty render because
  the fetch trigger is a debounced `afterAttach` autorun. A display supplies
  `viewSignature`, whose default (`undefined`) never fetches and never exports:
  a forgotten override hangs the export, deliberately, since stale ships wrong
  pixels.

**An empty viewport is terminal.** A view with no content block (every region
under `minimumBlockWidth`, i.e. `showAllRegions` on a scaffold-level assembly)
issues no fetch, so both freshness answers stay false forever. `viewportEmpty`
(`packages/display-kit/src/viewportEmpty.ts`, over the view's
`hasVisibleContent`) makes it terminal inside `foundationSvgReady`'s freshness
thunk. The same term feeds `computeActivityPhase` and `paintInert`, so the three
"finished" answers cannot disagree.

#### Who answers `dataCurrent` by signature

<!-- BEGIN GENERATED FRESHNESS_SIGNATURE_CENSUS -->

_Generated by `pnpm autogen` — edit the source, not this block._


13 models across 3 packages answer `dataCurrent` by comparing the signature their data was loaded for against the one the live view calls for. A display joins by calling `isDataCurrent` and leaves by not calling it.

<!-- prettier-ignore -->
| Model | Loaded signature | Live signature |
| --- | --- | --- |
| `packages/core/src/util/adapterMetadata.ts` | `cached.adapterConfig` | `adapterConfig` |
| `packages/core/src/util/installFetch.ts` | `heldKey()` | `fetchKey(args)` |
| `packages/core/src/util/installPrerequisiteFetch.ts` | `read.adapterConfig` | `host.adapterConfig` |
| `packages/core/src/util/installPrerequisiteFetch.ts` | `adapterConfig` | `self.adapterConfig` |
| `packages/display-kit/src/CoarseTierMixin.ts` | `held.key` | `read.key` |
| `packages/display-kit/src/installGlobalFetchAutorun.ts` | `self.loadedFetchKey` | `issue.signature` |
| `packages/display-kit/src/KeyedFetchMixin.ts` | `self.loadedFetchKey` | `self.currentFetchKey` |
| `packages/display-kit/src/MultiRegionDisplayMixin.ts` | `self.loadedRegions.get(displayedRegionIndex)?.fetchInputs` | `self.fetchInputs` |
| `packages/display-kit/src/MultiRegionDisplayMixin.ts` | `loaded.fetchInputs.settings` | `settings` |
| `packages/display-kit/src/RegionTooLargeMixin.ts` | `self.gateMeasuredViewportKey` | `self.gateViewport?.key` |
| `packages/display-kit/src/regionTooLargeUtils.ts` | `tierKey` | `currentTierKey` |
| `plugins/canvas/src/LinearMultiRowFeatureDisplay/partitionFields.ts` | `loaded.fetchInputs.settings` | `settings` |
| `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` | `tierKey` | `host(self).byteGateAdapterConfig` |
<!-- END GENERATED FRESHNESS_SIGNATURE_CENSUS -->

### The view-level wait: `awaitViewInitialized`

Every view's `renderToSvg` opens with `awaitViewInitialized(model)`
(`@jbrowse/core/svg/svgReady`). A bare `when(() => model.initialized)` hangs
silently when an assembly fails to load. The helper waits on `(initialized &&
!pendingLaunch) || error` and throws the error into the dialog banner.
`pendingLaunch` matters because `initialized` can go true mid-launch while tracks
are still attaching; headless jbrowse-img hits that race routinely. The
breakpoint split view also waits on its panels.

So every view's `error` must be **resolved** (assembly errors and sub-view
errors folded in), not the raw `volatileError`. A view whose resting state draws
nothing (the circular view on its import form) throws here rather than saving a
blank canvas.

### Every resting state that never fetches must be terminal

`dataCurrent` says whether held data is current, not whether data will ever
arrive. If a display can sit indefinitely with its fetch trigger false, that
state must reach `svgReady` through `error`, `regionTooLarge`, `fetchCanceled` or
`fetchInert`. `renderToSvg` awaits every display and `awaitSvgReady`'s only bound
is the half-hour `SVG_READY_TIMEOUT_MS` backstop, so one such track hangs the
whole view's export. Minimized tracks and the empty viewport are already handled.

Read a display's fetch gate and ask what leaves it declining forever:

- **A failed prerequisite fetch.** HiC gates on `effectiveResolution`, supplied
  by a one-shot `CoreGetInfo`. A prerequisite whose failure is terminal belongs
  in `setError`, not `notifyError`. If it is retriable, drive it from an autorun
  on `reloadCounter` so the retry button re-runs it. Cover every failure shape,
  including a `CoreGetInfo` that resolves with an empty binsize list.
- **The containing view is empty.** The chord display's fetch gates on
  `view.displayedRegions.length`, so its `extraTerminal` is
  `!view.displayedRegions.length`. Read what the fetch autorun reads.
- **The loading overlay is the on-screen twin.** `!fetchLanded && !error` spins
  forever on a never-fetching state. Answer it once and read that getter
  everywhere, as `LinearSyntenyDisplay.fetchInert` (`isMinimized ||
  !connectedViews`) does for its fetch gate, `loading` and `svgReady`.
- **Cross-display readers.** `displaysSettled` (`@jbrowse/synteny-core`) reads
  `fetchInert` too. That is why `fetchInert` is an overridable `FetchMixin` hook
  defaulting to `false`: a consumer can only read a name the mixin declares, and
  the strict default hangs (diagnosable) rather than reporting done with nothing
  drawn.

The sequence display overrides `fetchInert` to return `zoomedOut`, since past its
base-render threshold it shows a static message and issues no fetch.

### View geometry is measured after the displays' waits

A `renderToSvg` that reads canvas size before awaiting the displays sizes the
canvas for the pre-wait geometry while the bodies draw against the post-wait one.
Dotplot plot rects move with zoom or diagonalize; the circular figure's size,
center and rotation move with zoom or drag. Read geometry on the line after the
`Promise.all`.

A view's on-screen padding is not the export's. The circular view takes
`max(paddingPx, measured label width)` for export, with the measurement in
`rulerLabels.ts` shared by `Ruler.tsx` and the export.

### Displays outside the two LGV mixins

- **HiC and LD** compose `GlobalFetchMixin` and override only `viewSignature`.
- **Multi-LGV synteny** is non-LGV (`BaseDisplay` with its own fetch). It calls
  `computeSvgReady` with `dataCurrent = ready && !refetching && dataCurrent`
  (`ready` = `featureData !== undefined`). It needs both terms: `!refetching`
  covers the in-flight RPC, while `dataCurrent`
  (`loadedFetchKey === currentFetchKey`) covers the 500ms debounce window where
  held data is invalid but `fetching` has not flipped.
- **Dotplot**: `!!instanceData && dataCurrent`. It reads `instanceData`, not
  `geometry`, because the export polls outside a reactive context and `geometry`
  would recompute every segment color per poll.
- **Circular chord**: `ready`; a chord fetch covers the whole view.
- **Circular rings**: a linear display on the circle exports through its own
  `renderSvg` (plot only). The ring painter serializes, rasterizes and warps each
  strip. Where no image decoder exists (node, jsdom) rings are skipped up front
  and named through `notifySkippedSvgTracks`.

Synteny and dotplot draw **no `SvgChrome`**: every display in a level paints the
same band, so a box would cover its siblings. A failed track throws from its own
`awaitSvgReady`, and views fan out through `awaitSvgRenders` (nestable; failures
flatten) so one export names every broken track.

### The shared freshness name

Every foundation answers one question under one name, **`dataCurrent`**: does
the held data match what is on screen now? There are two mechanisms.

| Mechanism | Foundation | Implementation |
| --- | --- | --- |
| Spatial coverage | `MultiRegionDisplayMixin` | `viewportWithinLoadedData && loadedRegions.size > 0` |
| Signature compare | `GlobalFetchMixin` (HiC, LD), synteny, dotplot | `isDataCurrent(loaded, current)` |

Consumers (`computeSvgReady`, the `settled` gates, BreakpointSplitView's
overlays) read `dataCurrent`, never the mechanism. `isDataCurrent`
(`@jbrowse/core/util`) is `loaded !== undefined && compareStructural(loaded,
current)`. The keyed families run it on `KeyedFetchMixin` (ADR-105): a display
supplies `viewSignature`, and the mixin pairs it with `settingsFetchInputs`,
stamps the key at commit and drops it on `reload()`.

## On-screen capture gate (`settled` → `*_canvas_done`)

`settled` gates the on-screen GPU canvas for screenshots and browser tests
(`DotplotView.settled` → `dotplot_webgl_canvas_done`,
`LinearSyntenyViewHelper.settled` → `synteny_canvas_done`). It is `canvasDrawn &&
!initPending && !pendingAutoDiagonalize && displaysSettled(displays)`, where
`displaysSettled` (`comparativeReadiness.ts` in `synteny-core`) is
`every(fetchInert || (!isLoading && !fetchCanceled && dataCurrent))`.

- `dataCurrent` is needed because dotplot's init-time autoDiagonalize reorders
  the query axis and no fetch is in flight for about a second, so stale data
  draws against the new axes. It only reproduces on a cold cache.
- `pendingAutoDiagonalize`: a skipped or errored diagonalize never reorders, so
  its data is `dataCurrent`; the flag makes `settled` wait for the reorder.
- `initPending`: before the apply adds displays, `every` over none is true and
  the gate would open on a cleared canvas.

## PaintLayer: raster-vs-vector dispatch

`PaintLayer` (`@jbrowse/core/util/paintLayer`) is a component that renders a 2×
DPR raster canvas (`opts.rasterizeLayers`, as `<image>`) or an `SvgCanvas`
(`<g dangerouslySetInnerHTML>`). The caller draws to `Ctx2D` in CSS pixels
either way.

- A vector layer whose `paint` drew nothing renders nothing, not an empty `<g>`,
  clipping included (`SvgCanvas.clip()` queues its group until something draws).
  A body may mount a conditional layer unconditionally.
- Omitting `opts` pins a layer to vector, which the canvas feature export uses
  for crisp label and peptide text.
- **A scale that rounds to zero must not go in the ctx matrix.** `serializeSvg`
  rounds every `transform` to 2 decimals, so a `ctx.scale` below 0.005 exports
  blank. Hi-C's `viewScale` is `1 / bpPerPx` and hit this at megabase windows. A
  uniform scale commutes with rotation: multiply it onto the coordinates and keep
  only O(1) terms on the ctx stack. Suspect this first for an export that is blank
  only in wide views.
- **No hand-rolled JSX-SVG for anything draw-shaped** in `renderSvg.tsx`; it
  cannot rasterize and drifts from on-screen output. Permitted exceptions:
  - Trivial chrome: scalebars, separator lines, clipPath wrappers, transform
    `<g>` (use `SvgClipRect` from `@jbrowse/plugin-linear-genome-view`).
  - Bezier-arc overlays (sashimi, paired arcs in `plugins/alignments`) sharing a
    `computeXxxArcs(opts) → Arc[]` with the on-screen overlay. "Interactive" is
    not a reason to add an exception. The arc plugin's vector exception ended
    with ADR-163.
  - Shared React-SVG overlays the screen also uses (`VariantLabels`,
    `LinesConnectingMatrixToGenomicPosition`, `SvgRowLabels`/`SvgTreePath` from
    `@jbrowse/tree-sidebar`), via an `exportSVG` prop. Such an overlay must be
    **passive**: a control and a caption cannot share a component (multiway lane
    headers split into `LaneHeaders` and `SvgLaneHeaders` over `laneHeaderRows`).

**Shared utilities** (`@jbrowse/core`): `createSvgRasterCanvas`, `PaintLayer`,
`SvgChrome`/`SVGMessageBox`/`SvgClipRect` (`svg/SvgExport`), `SvgThemeProviders`,
`serializeSvg`, `exportViewSvg(view, opts, load)`, and `Ctx2D =
CanvasRenderingContext2D | SvgCanvas`.

## Clip-path ids must be model-scoped

Every `id` on a `<clipPath>`/`<use>` is scoped by the owning view or display
model's `.id`, never a bare literal or only `trackId`/block key/index. SVG ids are
document-global and browsers resolve `url(#x)` to the first match, so the second
clipped group renders unclipped. It surfaces only when two view panels share a
document (synteny rows, breakpoint-split). `exportAndVerifySvg`
(`products/jbrowse-web/src/tests/util.tsx`) asserts no duplicate ids. Prefer
`SvgClipRect`.

`SvgCanvas.clip()` is the one exception: no MST node is in scope, so it mints ids
from a module-level counter. Do not change it to `.id`.

A counter that runs for the process life breaks determinism: unchanged views
export different bytes and `jest -t` on any export test but the first fails its
snapshot. `withFreshSvgClipIds` in `serializeSvg` gives each document its own
numbering run. `serializeSvg` is the one funnel (through `wrapSvgExport`, plus
ring strips), and its `renderToStaticMarkup` is synchronous, so no other export
interleaves; a reset on an `await`-crossable boundary would collide. The run
restores the counter afterward because live figures (`useViewSvgFigure`) mint
from it into page DOM. `wrapSvgExport.test.tsx` and `serializeSvg.test.tsx` pin
both.

## Serialization: `serializeSvg`

`serializeSvg` applies the HTML-to-SVG-file differences once:

- **XML entities only.** U+00A0 becomes `&#160;`, since `&nbsp;` is undefined in
  XML and breaks the `.svg`, the PNG path and `rsvg-convert`.
- **SVG 1.1 colours.** `splitPaintAlpha` splits a colour a `<color>` cannot carry
  (theme `rgba()`) into `rgb()` plus `*-opacity`, folding into existing opacity;
  `SvgCanvas.paintAttr` uses the same split.
- **Rounded numbers** in a whitelist of numeric attributes.

Every export tree mounts `SvgThemeProviders`, or a `usePalette` body draws in the
default light theme.
