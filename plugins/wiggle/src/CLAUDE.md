# plugins/wiggle

Two displays over two shaders, one Canvas2D twin and one hit test, all in
`src/shared`. Scale/axis/score machinery is `packages/wiggle-core`, because six
other plugins draw a wiggle-shaped axis against it.

## Two shaders, because a module reflects one instance struct

`wiggle.slang` fills (xyplot, density, scatter) on a 20-byte record;
`wiggleLine.slang` strokes (line, linecenter) on a 40-byte one. Only stroked
renderings read a neighbour, so while they shared a shader every fill buffer
carried those 20 bytes for nothing — 164MB rather than 82MB at 1000 sources,
against a 256MB `maxBufferSize` floor, which is a zoom ceiling rather than
waste.

`wiggleCommon.slang` holds what they must agree on: the struct is shared, the
**binding is not**, and each re-imports `colorPack`/`hpmath`.

**The pass, the buffer, the `renderingType` uniform and the Canvas2D painter all
come off the encoded layers, never off `renderState`.** Encode and render are
separate autoruns and render is registered first, so the frame after a plot-type
switch sees a state that moved and a region that has not. Drawing the previous
plot for one frame is the correct stale.

The consequence differs by backend and the rule does not: on the GPU the two
record sizes mean a pass reading the wrong one reads past the end of its
instances; on Canvas2D the layer SET is chosen by the rendering (`filled` splits
whiskers by sign) and so is `gapLimitBp`, so the new painter over the old layers
is a plot that is neither. Canvas2D read `state` until 2026-08 and drew chords
across every hole for that frame.

Each pass packs its own buffer and returns **empty** for renderings that are not
its own — an empty pack is how a pass releases its buffer.

## The two displays differ in one thing, and `plotGeometry` is it

Single-wiggle insets by `YSCALEBAR_LABEL_OFFSET` so end labels aren't clipped
and draws one row; multi-wiggle stacks `numRows` rows edge-to-edge over the full
height. `{ yTop, plotHeight, numRows, tickHeight }` states that once, and every
half that has to move with it reads it: `computeYTicks`' height and offset, the
render state, the on-screen `<canvas>` box, and `WiggleFamilySvgFrame`'s clip
translate — a prop there, defaulting to the single-plot box, which is what the
Manhattan display (no such getter) still draws in.

**Everything written over it is `wiggleDisplayViews`**: `ticks`, `scoreRamp`,
`renderState` and the shared halves of the two props methods, as a plain
function each display installs as one `.views()` layer. Not a mixin — composed
beside `TrackHeightMixin` it could not see `height` or `canvasWidthPx` without
casting to reach them, and `types.compose` depth is a real ceiling (ADR-041).

**`sharedRpcProps` / `sharedGpuProps` are named apart from the methods they
feed, deliberately.** MST _intersects_ what each `.views()` layer returns, so
two same-named methods resolve to the **first** at the type level however the
runtime member behaves; the super-capture override reads as working only where
every key it adds is optional. Each display spreads the shared half into its own
`rpcProps()` / `gpuProps()`, and what it adds there is what is genuinely its
own: single-wiggle's `useBicolor` key and solid-color `negColor` override,
multi-wiggle's `summaryScoreMode` key and row list.

`fetchNeeded` is the one statement still made twice. What differs is the RPC
method name — which `ARCHITECTURE.md` wants at the call site so the registry's
typed args survive — plus multi-wiggle's structural `sources` argument.

## Multi-wiggle's rows are a getter over `rpcDataMap`

Each region's payload carries the full source list, entries leave that map only
via `clearAllRpcData`, so the row set IS the first-seen union over its values —
`sourcesFromRegionData`, unioned rather than read off the first region because a
plain fallback adapter discovers its sources per region. There is no second
store to keep in step, which is what `sourcesVolatile` was.

**The comparer on that computed is load-bearing.** The list reaches
`gpuProps()`, whose identity re-encodes every loaded region, so a refetch
reporting the same rows has to hand back the same array — `compareStructural`,
and the metadata is stripped off the payload first so the compare never walks a
feature array. MAF's `sourcesVolatile` buys the same property with a `deepEqual`
before the write; either way it is the property, not the mechanism, that
matters.

## `viewportWidth` is CSS px — `clip.scissorW`, never `clip.pxW`

`canvasHeight` is CSS px and the shader mixes axes; device px halves the
min-width floor at dpr 2, makes the step-line stroke half as wide as it is tall,
and shears the capsule. `gpuWiggleRenderer.test.ts` pins it. `GpuMafRenderer`
feeds `pxW` to a same-named uniform in a different shader and says its own floor
is unresolved — not a precedent.

## Three separate decisions inside "how wide is a bar"

- **Floor**: `MIN_FILL_WIDTH_PX`, `export-consts`ed from `wiggleCommon.slang`
  (adr-051), re-exported as `WIGGLE_MIN_PX`. One number, both backends.
- **`WIGGLE_FUDGE_FACTOR` (0.8px) is Canvas2D-only.** `fillRect` at fractional
  coords leaves hairline gaps; adjacent GPU quads on a multisampled target
  don't. The shader must not grow a matching fudge.
- **Anchor is shared**: both grow a floored bar away from the bin's _start_ —
  the reversed-block family in `packages/render-core/CLAUDE.md` owns the rule.

## `makeScoreNormalizer` is the one `js-export` twin that doesn't retire

It hoists log arithmetic out of a per-feature loop; the generated
`normalizeScore` is per-call scalar and kept as an **oracle**
(`normalizeScoreParity.test.ts`). Both floored the log domain at 1 once,
flattening any domain under 1 — the floor is the domain's own min. `scoreToY` is
`js-skip`ed for the one allowed disagreement, a degenerate (`min === max`)
domain.

## `rowIndex` is the position in the display's own `sources`

Never the payload's — a source missing from the payload leaves its row empty
instead of shifting everything below it. Overlay collapses onto row 0.

`findRowHit` picks `visibleSources[floor(offsetY / rowHeight)]`, so
`effectiveRowHeight` must equal the renderer's `getRowHeight(...)`. `numRows` is
floored at 1 or the shader seeds the row transform with Infinity.

## Three gap rules, one owner each

- **Step line** breaks on bp adjacency. `0` is both the gap sentinel and a legal
  score — harmless only because a 0-scoring feature draws the same either way.
- **`linecenter`** connects consecutive pairs regardless of adjacency (reduced
  BigWig data is full of non-tiling bins); only a hole past `gapLimitBp` breaks
  it, computed once per layer and read by both the encoder and `drawLineCenter`.
  Measured in **bp, not px** — px drifts from the encoded break wherever a block
  is clipped.
- **`DEFAULT_GAP_BREAK_MULTIPLE` is 0 (off)** after shipping at 20;
  `gapBreak.ts`.

## Effective vs raw `summaryScoreMode`

`effectiveSummaryScoreMode` resolves whiskers to `avg` under density, and the
autoscale domain, menu radio, tooltip and `gpuProps` all read it. **`rpcProps`
carries the raw slot** — the effective one moves with the rendering type, so
switching to density would re-download every region.

`bicolorPivot` crosses both ways: the worker owns the `avg`-path pos/neg split
(ADR-016), the whiskers bands are colored main-thread.

## Whiskers splits into solid layers only when the bars nest

`isDensityMode || (isFilled && bands.length > 1)`. Back-to-front, largest
magnitude first — the opposite order on each side of the pivot, which a single
band order can't express. Density needs it because `drawDensity` builds one
gradient per layer. Everything else keeps the band whole with per-instance
colors; splitting line or scatter breaks continuity at every pivot crossing.

## The colour key takes the mode, not `isDensityMode`

`sourcesLogic.ts` owns the three-mode colour table and `buildLegendItems` takes
its `RowColorMode`, because **the fallback belongs to the mode as much as the
channel does**. Outside density an unset `color` really is painted in
`posColor`, so the key resolves to it; in density `posColor` is the score ramp
and identity comes from `SvgRowLabels`, which paints a row with no `labelColor`
as no swatch — so an uncoloured density row gets no key entry either. Reachable
whenever a density track mixes grouped subtracks with ungrouped ones.

## The shipped arrays are aliased — read, never write

`processFeaturesFromArrays` aliases min/max onto `featureScores` when there's no
summary variation, and an all-positive window's `pos*` arrays onto the full
arrays. Structured clone preserves the sharing; `collectWiggleTransferables`
dedupes and takes **every region's result at once** so the dedupe spans regions.
A pass normalizing a band in place rewrites the average scores under every other
reader, and the throw lands at the `postMessage`, nowhere near the cause.

Nothing shares a buffer across regions, because `processFeaturesFromArrays`
copies its inputs. Keep it that way: aliasing the adapter's arrays instead looks
free and retains 20 bytes a feature on the main thread where copying retains 12
— costed in `agent-docs/reference/REJECTED_IDEAS.md`.
