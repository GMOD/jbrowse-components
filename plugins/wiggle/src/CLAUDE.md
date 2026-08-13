# plugins/wiggle

Two displays over two shaders, one Canvas2D twin and one hit test, all in
`src/shared`. Scale/axis/score machinery is `packages/wiggle-core`, because six
other plugins draw a wiggle-shaped axis against it.

## Two shaders, because a module reflects one instance struct

`wiggle.slang` fills (xyplot, density, scatter) on a 20-byte record;
`wiggleLine.slang` strokes (line, linecenter) on a 40-byte one. Only the two
stroked renderings read a neighbour — the step-line's `prevScore`/`nextScore`,
the center-line's `prevStartEnd`/`prevScoreLine` — and one module means one
layout, so while they all shared a shader every fill buffer carried those 20
bytes for nothing. At 1000 sources that was 164MB rather than 82MB in the single
allocation a region's sources are packed into, against a 256MB `maxBufferSize`
floor, which is a zoom ceiling and not just waste.

`wiggleCommon.slang` holds what they must agree on — the `Uniforms` struct, the
mode enums, and the score math — following `alignmentsUniforms`: the struct is
shared, the **binding is not** (each declares its own
`ConstantBuffer<Uniforms>`), and each re-imports `colorPack`/`hpmath`, since
Slang does not re-export through an import. `consts-out` takes the whole
`export-consts` list, so every generated constant lives there and
`wiggleRenderModes.generated.ts` stays one file.

**The pass, the buffer and the `renderingType` uniform all come off the encoded
layers, never off `renderState`** (`SourceRenderData.renderingType`, stamped by
`buildSourceRenderData`). Encode and render are separate autoruns and render is
registered first, so the frame after a plot-type switch sees a state that moved
and a region that has not; with two record sizes in play, a pass reading the
wrong one reads past the end of its instances. Drawing the previous plot for one
frame is the correct stale.

Each pass packs its own buffer and returns **empty** for renderings that are not
its own — an empty pack is how a pass releases its buffer — so a region holds
only the layout it draws.

## The two displays differ in one thing: the vertical inset

Single-wiggle insets by `YSCALEBAR_LABEL_OFFSET` top and bottom so the end
labels aren't clipped; multi-wiggle stacks rows edge-to-edge at full height.

One decision, two halves that must move together: the render height
(`axisPlotBox(height).plotHeight` vs bare `height`) and `computeYTicks`' offset
(default vs `0`). Split them and ticks label the wrong data.
`WiggleFamilySvgFrame` bakes in the single-wiggle inset, so multi keeps its own
SVG body — parameterize the inset before unifying them.

## `viewportWidth` is CSS px — `clip.scissorW`, never `clip.pxW`

`canvasHeight` is CSS px and the shader mixes axes: `hwx` converts through
`viewportWidth`, `hwy` through `canvasHeight`, and the capsule takes `dxPx` from
one and `dyPx` from the other. Device px halves the min-width floor at dpr 2,
makes the step-line stroke half as wide as it is tall, and shears the capsule.
`gpuWiggleRenderer.test.ts` pins it.

`GpuMafRenderer` feeds `pxW` to a same-named uniform in a different shader, with
its own note saying MAF's floor is unresolved. Not a precedent.

## Three separate decisions inside "how wide is a bar"

- **Floor**: `MIN_FILL_WIDTH_PX`, `export-consts`ed from `wiggleCommon.slang`
  (adr-051), re-exported as `WIGGLE_MIN_PX`. One number, both backends.
- **`WIGGLE_FUDGE_FACTOR` (0.8px) is Canvas2D-only.** `fillRect` at fractional
  coords antialiases its own edges and leaves hairline gaps; adjacent GPU quads
  sharing an exact edge on a multisampled target don't. The shader must not grow
  a matching fudge.
- **Anchor is shared**: both grow a floored bar away from the bin's _start_
  (`spanLeft` / `extendToMinWidthX`). Anchoring the leftmost edge is identical
  forward and wrong by a whole floor reversed — see the reversed-block family in
  `packages/render-core/CLAUDE.md`.

## `makeScoreNormalizer` is the one `js-export` twin that doesn't retire

It's a factory hoisting log arithmetic out of a per-feature loop; the generated
`normalizeScore` is per-call scalar and kept as an **oracle**, swept against it
by `normalizeScoreParity.test.ts`. Both floored the log domain at 1 once, which
flattened any domain sitting under 1 — the floor is the domain's own min.

`scoreToY` is `js-skip`ed for the one allowed disagreement: a degenerate
(`min === max`) domain, where JS returns 0 and the shader divides by an epsilon.

## `rowIndex` is the position in the display's own `sources`

Never the payload's — a source missing from the RPC payload leaves its row empty
instead of shifting everything below it. Overlay collapses onto row 0.

`findRowHit` picks `visibleSources[floor(offsetY / rowHeight)]`, so
`effectiveRowHeight` must equal the renderer's
`getRowHeight(canvasHeight, numRows)`. `numRows` is floored at 1 in
`makeWiggleRenderState` or the shader's `canvasHeight / numRows` seeds the row
transform with Infinity.

## Three gap rules, one owner each

- **Step line** breaks on bp adjacency: `prevAdj`/`nextAdj` in the encoder,
  `inRun`/`gapAfter` in `drawLine`. `0` is both the gap sentinel and a legal
  score — harmless only because a 0-scoring feature draws the same either way.
- **`linecenter`** connects consecutive pairs regardless of adjacency (reduced
  BigWig data is full of non-tiling bins); only a hole past `gapLimitBp` breaks
  it. That number is computed once per layer in `buildSourceRenderData` and read
  by both the encoder and `drawLineCenter`. Measured in **bp, not px** — px
  drifts from the encoded break wherever a block is clipped.
- **`DEFAULT_GAP_BREAK_MULTIPLE` is 0 (off)** after shipping at 20; see
  `gapBreak.ts`.

## Effective vs raw `summaryScoreMode`

`effectiveSummaryScoreMode` resolves whiskers to `avg` under density. The
autoscale domain, the menu radio, the tooltip and `gpuProps` all read it.

`rpcProps` carries the **raw** slot: the effective one moves with the rendering
type, and anything in `rpcProps` invalidates the fetch, so switching to density
would re-download every region.

`bicolorPivot` crosses both ways — the worker owns the `avg`-path pos/neg split
(ADR-016), the whiskers bands are colored main-thread.

## Whiskers splits into solid layers only when the bars nest

`isDensityMode || (isFilled && bands.length > 1)`. Back-to-front, largest
magnitude first, which is the opposite order on each side of the pivot — a
single band order can't express it. Density needs it because `drawDensity`
builds one gradient per layer.

Everything else keeps the band whole with per-instance colors; splitting line or
scatter breaks continuity at every pivot crossing.

## The shipped arrays are aliased — read, never write

`processFeaturesFromArrays` aliases min/max onto `featureScores` when there's no
summary variation, and an all-positive window's `pos*` arrays onto the full
arrays. Structured clone preserves the sharing; `collectWiggleTransferables`
dedupes. A pass that normalizes a band in place rewrites the average scores
under every other reader.

It takes **every region's result at once**, not one, so the dedupe spans regions
too. Nothing shares a buffer across regions while `processFeaturesFromArrays`
copies its inputs — but that copy is the obvious thing to remove next, and
`@gmod/bbi` hands a one-region `getFeaturesAsArraysMulti` back as views into a
single buffer, so aliasing instead of copying would make cross-region sharing
normal. The throw it produces lands at the `postMessage`, nowhere near the
cause.
