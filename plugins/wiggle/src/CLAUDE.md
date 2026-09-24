# plugins/wiggle

One display over five shaders, one Canvas2D twin and one hit test, all in
`src/shared`. Scale/axis/score machinery is `packages/wiggle-core`, because six
other plugins draw a wiggle-shaped axis against it.

`LinearWiggleDisplay` registers against both `QuantitativeTrack` and
`MultiQuantitativeTrack`; the track types differ in adapter shorthand and
add-track workflow, and `MultiQuantitativeTrack/displayDefaults.ts` is the whole
of what they differ in on screen — one row per source, average scores, 200px,
seeded into `displayDefaults` through `Core-preProcessTrackConfig`. ADR-143.

## Four records, because a module reflects one instance struct

The fill record (20 bytes, `WiggleFillInstance` in `wiggleCommon.slang`) feeds
`wiggle.slang` (xyplot, scatter) and `wiggleDensity.slang` (density as the
composed render-core `rowRect` shape, drawn off the fill pass's buffer via
`bufferPassId`). `wiggleLine.slang` strokes the step line on 32 bytes and
`wiggleLineCenter.slang` the interpolated line on 36, each with a buffer of its
own. Only stroked renderings read a neighbour, so while every rendering shared a
shader every fill buffer carried those 20 bytes for nothing — 164MB rather than
82MB at 1000 sources, against a 256MB `maxBufferSize` floor, which is a zoom
ceiling rather than waste.

The two line renderings read different neighbours: the step line the previous
and next scores, the center line the previous bin's span and score. Sharing one
44-byte record carrying both cost an FST scan's raw section at 1000 sources
586MiB, against 426MiB (step) and 480MiB (center) split.
`ideas/waiting-on-someone-else/wiggle-instance-records-carry-per-row-constants.md`
has the measurements.

`wiggleBand.slang` fills a line plot's whiskers band on a 44-byte record. **The
GPU draws it after the lines with `blend: behind`**, because the interpolated
line's max blend is only valid over an empty target. `MarkContext2D` exposes no
compositing operator, so on Canvas2D band layers sort first and the line marks
paint them. The band packer runs last source first so overlaid bands stack as
Canvas2D's in-order source-over does.

`wiggleCommon.slang` holds what they must agree on: the uniform struct, the fill
record, `rowScoreToYPx` (where a score lands in its row, for both lines and the
band) and `bandColorAt`, the colour of the band between two cuts a line is in,
are shared, the **binding is not**, and each re-imports `colorPack`/`hpmath`.
The gradient's colour parity across GPU / Canvas2D / SVG, for density, bars and
points, is swept by `densityColorParity.test.ts`; its autoscale-pan cost (one
uniform write, zero buffer bytes, zero texture uploads) is pinned per rendering
in `wiggleMarks.test.ts`. The `fill` and `density` passes each bind the LUT
texture, since a texture binds per pass and not per buffer.

**The mark that draws, the buffer, the `renderingType` uniform and the Canvas2D
painter all come off the encoded layers, never off `renderState`** — each of the
five marks in `WIGGLE_MARKS` declines a block through `paintsBlock` when the
region's layers are not its family. Encode and render are separate autoruns and
render is registered first, so the frame after a plot-type switch sees a state
that moved and a region that has not. Drawing the previous plot for one frame is
the correct stale.

The consequence differs by backend and the rule does not: on the GPU the record
sizes mean a pass reading the wrong one reads past the end of its instances; on
Canvas2D the layer SET is chosen by the rendering (`filled` splits whiskers by
sign) and so is `gapLimitBp`, so the new painter over the old layers is a plot
that is neither. Canvas2D read `state` once and drew chords across every hole
for that frame.

Each pass packs its own buffer and returns **empty** for renderings that are not
its own — an empty pack is how a pass releases its buffer.

## `rows` is the layout, and `plotGeometry` is where it lands

`rows: 'source'` is one row per source — the tree sidebar, row labels,
separators, clustering and the row-order sort all hang off `isRowLayout`.
`rows: ''` puts every source in one plot box. The five `renderingType` names say
what a source is drawn as and nothing about the layout, which is why there is
one table and not nine names. `rows.field` admits `source` alone, and a leftover
`facet` in the display config fails the load naming `rows: "source"`
(`checkRowsField`). The same object holds the reader's arrangement, which
`TreeSidebarMixin` owns (`packages/tree-sidebar/CLAUDE.md`, ADR-157);
`setRowLayout` writes the field alone, so the arrangement survives a trip
through the shared plot.

**One plot box takes the `YSCALEBAR_LABEL_OFFSET` inset** so its end labels
aren't clipped; a stack of rows gives it up, because the axis is drawn per row
and maximum density is the point. `{ yTop, plotHeight, numRows, tickHeight }`
states that once, and every half that has to move with it reads it:
`computeYTicks`' height and offset, the render state, the on-screen `<canvas>`
box and the export's clip translate. Wiggle-core's `ScorePlotChrome` and
`ScorePlotSvgFrame` take it as a prop defaulting to the single-plot box, which
is what the Manhattan and mark displays (no such getter) draw in.

**The layout's colour default lives in `effectiveColor`, not in a slot
default.** A slot default cannot move with the layout, and this one does:
several sources sharing one plot box default to `{ field: 'source' }`, because
overlaid plots need a colour each to be told apart, while a row per source and a
lone plot in the box default to the threshold pair a quantitative track has
always drawn. `colorEncoding` resolves it through display-kit's
`colorEncodingOf`, the one resolver every display's colour object goes through,
and `resolveWiggleColor` turns that into
`{ posColor, negColor, pivot, rampLut, rampMid, perSource }`, which is the whole
of what the layers and both backends read. `pivot` is where the colour parts and
never where bars grow from: the render state carries both, bars read `origin`,
and the lines, band and density fade read `pivot`. A gradient (`rampLut`, from
`linear` or `log`) colours each bar, point and density cell by its score's
position, `rampMid`, the config's `domainMid`, on its middle stop, and never
reads `origin`; the white fade, a threshold's density, measures distance from
`pivot`. The lines alone still part under a gradient, at `domainMid ?? origin`
in its two end colours, with a corner notice saying so. The gradient follows the
y domain and y scale; the colour's own `domainMin`/`domainMax` and
`linear`-vs-`log` go unread. `score` paints through `threshold`, `linear` and
`log`, `source` through `categorical`, and the other pairings paint the
misconfiguration grey, because a two-sided plot has nothing to paint a colour
per score or a cut over subtrack names with. ADR-144, ADR-153.

**Everything shared over the geometry is `wiggleDisplayViews`**: `ticks`,
`scoreColorScale`, `renderState` and the shared halves of the two props methods,
as a plain function the display installs as one `.views()` layer. Not a mixin —
composed beside `TrackHeightMixin` it could not see `height` or `canvasWidthPx`
without casting to reach them, and `types.compose` depth is a real ceiling
(ADR-041). `sharedRpcProps` / `sharedGpuProps` are named apart from the methods
they feed, deliberately: MST _intersects_ what each `.views()` layer returns, so
two same-named methods resolve to the **first** at the type level however the
runtime member behaves. gccontent composes this model, so the names still have
two hosts.

## A BigWig answers in bins below its first zoom level

`BigWigAdapter` puts up to two synthetic tiers in front of the file's zoom
levels (ADR-129). The range `getZoomRange` declares and the tier a fetch reads
come from two `tierSpanRange` calls, which `tierLevels` hands the same combined
list, so the two cannot drift apart. A synthetic fetch reads the raw section
over bin-aligned extents and bins each region with `binRawRegion`. **Whether a
zoom bins is the file's call, never the region's**: a bin under twice the mean
record span, sampled once per file, leaves the ladder. A per-region test let a
pan flip one locus between bins and raw at one zoom. Only overlapping or
out-of-order records, which the format forbids, still answer raw at a synthetic
zoom.

## The rows are a getter over `rpcDataMap`

Each region's payload carries the full source list, entries leave that map only
via `clearAllRpcData`, so the row set IS the first-seen union over its values —
`sourcesFromRegionData`, unioned rather than read off the first region because a
plain fallback adapter discovers its sources per region. There is no second
store to keep in step, which is what `sourcesVolatile` was.

That getter is a `stableIdentityComputed`
(`@jbrowse/display-kit/stableIdentityComputed`), which owns why: the list
reaches `gpuProps()`, whose identity re-encodes every loaded region. What is
local is that the metadata is stripped off the payload first, so the comparer
never walks a feature array. MAF's `sourcesVolatile` buys the same property with
a `deepEqual` before the write; either way it is the property, not the
mechanism, that matters.

## `viewportWidth` is CSS px — `clip.scissorW`, never `clip.pxW`

`canvasHeight` is CSS px and the shader mixes axes; device px halves the
min-width floor at dpr 2, makes the step-line stroke half as wide as it is tall,
and shears the capsule. `wiggleMarks.test.ts` pins it.

## Three separate decisions inside "how wide is a bar"

- **Floor**: `MIN_FILL_WIDTH_PX`, `export-consts`ed from `wiggleCommon.slang`
  (adr-051), re-exported as `WIGGLE_MIN_PX`. One number, both backends.
- **`CANVAS_SEAM_PX` (0.8px) is Canvas2D-only.** `fillRect` at fractional coords
  leaves hairline gaps; adjacent GPU quads on a multisampled target don't. The
  shader must not grow a matching fudge.
- **Anchor is shared**: both grow a floored bar away from the bin's _start_ —
  the reversed-block family in `packages/render-core/CLAUDE.md` owns the rule.

## `makeScoreNormalizer` is the one `js-export` twin that doesn't retire

It hoists log arithmetic out of a per-feature loop; the generated
`normalizeScore` is per-call scalar and kept as an **oracle**
(`normalizeScoreParity.test.ts`). Both floored the log domain at 1 once,
flattening any domain under 1 — the floor is the domain's own min.

**Both halves live in render-core, not here** — `src/shaders/scoreScale.slang`
and `src/scoreScale.ts` beside it, which wiggle-core re-exports. The coverage
band, the mark shapes and core's worker-resolved colour ramp normalize through
the same three branches. **A domain with no range is a step for all of them**: a
score above the min draws at the top, anything else on the baseline.
`wiggleCommon` keeps `scoreToY`, the plot-box wrapper, and `js-skip`s it — the
Canvas2D side composes the normalizer with its own box.

## One fetch, and `rowIndex` is the position in the display's own `sources`

`RenderMultiWiggleData` serves every quantitative adapter. An adapter handing
back typed arrays (BigWig, GCContent) carries one signal and no source column,
so the executor takes `fetchRegionRaws` and reports one unnamed source rather
than walking its features to build the one bucket they already are; only an
adapter carrying several sources in one file (bedMethyl, a bedGraph with a
source column) falls back to grouping.

`rowIndex` is never the payload's — a source missing from the payload leaves its
row empty instead of shifting everything below it. With `rows` unset, every
source collapses onto row 0.

`findRowHit` picks `visibleSources[floor(offsetY / rowHeight)]`, so
`effectiveRowHeight` must equal the renderer's `getRowHeight(...)`. `numRows` is
floored at 1 or the shader seeds the row transform with Infinity.

## Three gap rules, one owner each

- **Step line** breaks on bp adjacency. `0` is both the gap sentinel and a legal
  score — harmless only because a 0-scoring feature draws the same either way.
- **`linecenter`** connects consecutive pairs regardless of adjacency (reduced
  BigWig data is full of non-tiling bins); only a hole past `gapLimitBp` breaks
  it, computed once per layer and measured in **bp, not px** — px drifts from
  the encoded break wherever a block is clipped. `centerLinksToPrevious` applies
  it for the stroke and the whiskers band on both backends, so the ribbon breaks
  where the line does.
- **`DEFAULT_GAP_BREAK_MULTIPLE` is 0 (off)** after shipping at 20;
  `gapBreak.ts`.

## Effective vs raw `summaryScoreMode`

`effectiveSummaryScoreMode` resolves whiskers to `avg` under density, and the
autoscale domain, menu radio, tooltip and `gpuProps` all read it. **`rpcProps`
carries the raw slot** — the effective one moves with the rendering type, so
switching to density would re-download every region.

**No colour setting is a fetch key.** `color` and `origin` are `gpuProps` alone:
the worker ships one set of score arrays and the main thread colours each
instance by its side of the cut, so moving the cut re-encodes and refetches
nothing. ADR-016, which put the split in the worker, is superseded;
`ideas/waiting-on-someone-else/wiggle-instance-records-carry-per-row-constants.md`
§4 has what the split cost.

## A band splits into solid layers only when the bars nest

`isDensityMode || (isFilled && bands.length > 1)`. Back-to-front, largest
magnitude first — the opposite order on each side of the origin, which a single
band order can't express. Filled bars split at the origin they grow from and
carry `colorsAbgr` for the pivot where a threshold cuts elsewhere; density
splits at the pivot. Under a gradient bars and points carry no colour lane and
no whiskers tint: the ramp is the whole colour. Density needs it because
`drawDensity` builds one gradient per layer, and it is the only mode that
reaches the split with a single band (`avg`). Everything else keeps each band
whole and carries `colorsAbgr`, one packed colour per instance — or none at all
where both sides of the pivot come out the same colour, which is what a
solid-colour track is.

## A line plot is one line, coloured by the band between two cuts it is in

Every summary mode on `line`/`linecenter` draws one layer through all the bins
(`lineLayers`), with no per-instance colour lane. **Colour comes from the band
the line is in, not the bin**: the shader tests each fragment's centre-line y
against the cut heights its vertex placed (`bandColorAt`), and Canvas2D strokes
once per band through `BandPen`. Centre line rather than pixel, so capsules
overlapping at a joint agree under max blend unless the joint lies within half a
line width of a cut; per-bin colours blended every colour-changing joint to
magenta. Whiskers adds a `band` layer under the line, split the same way.

## The colour key follows the scale

The ramp wherever `scoreGradientPaints` — density, and bars or points under
`linear`/`log` — a row per source for `categorical`, a row per interval for a
`threshold` whose cut the config declared, and none for a string. A threshold
cutting at the `origin` draws none either: the axis already shows where the
origin is. Density's white fade is keyed only while no row brings its own
colour; a declared gradient ignores row colours, so it is keyed regardless, and
only density gives the ramp the axis's place.

**`scoreGradientPaints` moves a row's identity to `labelColor`** — the source
key, the row-label swatches and the arrangement dialog's one Color column all
read it there, so no key shows a swatch the plot does not paint.

**A reader's colour for a row is `rowColor`, and its label is `rows.labels`.**
`TreeSidebarMixin` arranges them over `discoveredRows` and writes the dialog's
submit; what is this display's is `identityChannel`, the channel a `rowColor`
entry lands on — `color`, or `labelColor` wherever `scoreGradientPaints` — ahead
of the adapter's colour and the palette, so a colour set on the plot moves to
the label tint when a gradient starts painting rather than into the ramp; in one
shared box there is no label to tint, so the colour goes to the plot whatever
the gradient. `group` has no config home, so a `group` pasted into the bulk
editor is read for the palettizer's "Color by group" and not kept.

**The palette is dealt by `TreeSidebarMixin`, over this display's order.** The
`rowColorDeal` hook is `sourceColorDeal`: one cursor over a colour per source's
`range` then `set1`, the groups first as they appear, then, for a colour per
source outside a gradient, the ungrouped subtracks its `domain` lists ahead. It
deals over the rows as currently arranged, as the display always has, so a
reorder can still recolour a row; the base arrangement is the flip ADR-159
names. `buildSources` paints the dealt colour after the row's own: on `color`,
or under a gradient on `labelColor` after the row's own `color`.

**Density is where the fallback differs.** Outside it an unset row `color` is
painted in the resolved `posColor`, so the key resolves to it; in density that
colour is the score ramp and identity comes from `SvgRowLabels`, which paints a
row with no `labelColor` as no swatch — so an uncoloured density row gets no key
entry either. Reachable whenever a density track mixes grouped subtracks with
ungrouped ones.

## The shipped arrays are aliased — read, never write

`processFeaturesFromArrays` aliases min/max onto `featureScores` when there's no
summary variation. Structured clone preserves the sharing;
`collectWiggleTransferables` dedupes and takes **every region's result at once**
so the dedupe spans regions. A pass normalizing a band in place rewrites the
average scores under every other reader, and the throw lands at the
`postMessage`, nowhere near the cause.

Nothing shares a buffer across regions, because `processFeaturesFromArrays`
copies its inputs. Keep it that way: aliasing the adapter's arrays instead looks
free and retains 20 bytes a feature on the main thread where copying retains 12
— costed and declined.
