# plugins/wiggle

Two displays over two shaders, one Canvas2D twin and one hit test, all in
`src/shared`. Scale/axis/score machinery is `packages/wiggle-core`, because six
other plugins draw a wiggle-shaped axis against it.

## Two shaders, because a module reflects one instance struct

`wiggle.slang` fills (xyplot, density, scatter) on a 20-byte record;
`wiggleLine.slang` strokes (line, linecenter) on a 40-byte one. Only the stroked
renderings read a neighbour, and one module means one layout, so while they
shared a shader every fill buffer carried those 20 bytes for nothing — 164MB
rather than 82MB at 1000 sources, against a 256MB `maxBufferSize` floor, which
is a zoom ceiling rather than just waste.

`wiggleCommon.slang` holds what they must agree on, following
`alignmentsUniforms`: the struct is shared, the **binding is not**, and each
re-imports `colorPack`/`hpmath` since Slang does not re-export through an
import. `consts-out` takes the whole `export-consts` list so
`wiggleRenderModes.generated.ts` stays one file.

**The pass, the buffer and the `renderingType` uniform all come off the encoded
layers, never off `renderState`.** Encode and render are separate autoruns and
render is registered first, so the frame after a plot-type switch sees a state
that moved and a region that has not; with two record sizes a pass reading the
wrong one reads past the end of its instances. Drawing the previous plot for one
frame is the correct stale.

Each pass packs its own buffer and returns **empty** for renderings that are not
its own — an empty pack is how a pass releases its buffer.

## The two displays differ in one thing: the vertical inset

Single-wiggle insets by `YSCALEBAR_LABEL_OFFSET` so end labels aren't clipped;
multi-wiggle stacks rows edge-to-edge. One decision, two halves that must move
together: the render height and `computeYTicks`' offset. Split them and ticks
label the wrong data. `WiggleFamilySvgFrame` bakes in the single-wiggle inset,
so parameterize that before unifying the SVG bodies.

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
  coords antialiases its edges and leaves hairline gaps; adjacent GPU quads on a
  multisampled target don't. The shader must not grow a matching fudge.
- **Anchor is shared**: both grow a floored bar away from the bin's _start_ —
  the reversed-block family in `packages/render-core/CLAUDE.md` owns the rule.

## `makeScoreNormalizer` is the one `js-export` twin that doesn't retire

It hoists log arithmetic out of a per-feature loop; the generated
`normalizeScore` is per-call scalar and kept as an **oracle**, swept by
`normalizeScoreParity.test.ts`. Both floored the log domain at 1 once,
flattening any domain under 1 — the floor is the domain's own min.

`scoreToY` is `js-skip`ed for the one allowed disagreement: a degenerate
(`min === max`) domain, where JS returns 0 and the shader divides by an epsilon.

## `rowIndex` is the position in the display's own `sources`

Never the payload's — a source missing from the RPC payload leaves its row empty
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
- **`DEFAULT_GAP_BREAK_MULTIPLE` is 0 (off)** after shipping at 20; see
  `gapBreak.ts`.

## Effective vs raw `summaryScoreMode`

`effectiveSummaryScoreMode` resolves whiskers to `avg` under density, and the
autoscale domain, menu radio, tooltip and `gpuProps` all read it. `rpcProps`
carries the **raw** slot: the effective one moves with the rendering type, and
anything in `rpcProps` invalidates the fetch, so switching to density would
re-download every region.

`bicolorPivot` crosses both ways — the worker owns the `avg`-path pos/neg split
(ADR-016), the whiskers bands are colored main-thread.

## Whiskers splits into solid layers only when the bars nest

`isDensityMode || (isFilled && bands.length > 1)`. Back-to-front, largest
magnitude first, which is the opposite order on each side of the pivot — a
single band order can't express it. Density needs it because `drawDensity`
builds one gradient per layer. Everything else keeps the band whole with
per-instance colors; splitting line or scatter breaks continuity at every pivot
crossing.

## The colour key takes the mode, not `isDensityMode`

`sourcesLogic.ts` owns the three-mode colour table and `buildLegendItems` takes
its `RowColorMode`, because **the fallback belongs to the mode as much as the
channel does**. Outside density an unset `color` really is painted in
`posColor`, so the key resolves to it; in density `posColor` is the score ramp
and identity is drawn by `SvgRowLabels`, which paints a row with no `labelColor`
as no swatch at all — so an uncoloured density row gets no key entry either.
Reachable whenever a density track mixes grouped subtracks (which always take a
group palette entry) with ungrouped ones (which take none).

## The shipped arrays are aliased — read, never write

`processFeaturesFromArrays` aliases min/max onto `featureScores` when there's no
summary variation, and an all-positive window's `pos*` arrays onto the full
arrays. Structured clone preserves the sharing; `collectWiggleTransferables`
dedupes, and takes **every region's result at once** so the dedupe spans
regions. A pass that normalizes a band in place rewrites the average scores
under every other reader, and the throw lands at the `postMessage`, nowhere near
the cause.

Nothing shares a buffer across regions, because `processFeaturesFromArrays`
copies its inputs. Keep it that way: aliasing the adapter's arrays instead looks
free and retains 20 bytes a feature on the main thread where copying retains 12
— costed in `agent-docs/reference/REJECTED_IDEAS.md`.
