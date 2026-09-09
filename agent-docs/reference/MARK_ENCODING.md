---
name: mark-encoding
description: The declared encoding from feature fields to mark channels, the worker RPC that evaluates it, the scale table the legend reads, and LinearMarkDisplay. Read before adding a channel, scale or shape, or moving another packer onto the encoder.
kind: spec
---

# The mark encoding

An authoring rung for the quantitative class: a track config names the marks
it wants and which feature fields feed each channel, one worker call per
region evaluates that, and the display draws what comes back through the
shared shapes. [ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
§"The grammar position, as one ladder" refused a mark grammar at the authoring
level on the ground that "the reader never picks a mark"; this is the rung
where a reader does, for the one class where the format decides nothing — a
BED score column, a segment ratio, a bedGraph-shaped interval.

## The three pieces

| Piece | Where | What it owns |
| --- | --- | --- |
| `MarkEncoding`, `encodeFeatures` | `packages/core/src/util/markEncoding.ts` | the declaration and its evaluation over the **lanes** the caller names: native `feature.get(field)` per channel, `jexl:` as the opt-in escape, a colour that is a constant, a jexl expression, a categorical palette or a ramp over a domain, a glyph that is a name, a jexl expression or a categorical scale over the glyph names, an integer `row`, the `y` extremes, a Flatbush over `(x, y, x2, y)` when `index` is named, and the `ScaleTable` per scaled channel |
| `CoreEncodeFeatures` | `packages/core/src/rpc/methods/CoreEncodeFeatures.ts` | one region's features fetched once, the `jexlFilters` applied, every layer of the request — an encoding and its lanes — run over the same list; answers `{ layers: EncodedChannels[] }` with `layers[i]` for the request's `layers[i]`, the buffers transferred |
| `LinearMarkDisplay` | `plugins/marks` | a `marks` slot of `{ shape, encoding }` sub-schemas, one `defineMark` per entry reading `layers[i]` through a lens that checks its shape's lanes are present (`SHAPE_LANES`), the wiggle-core score axis, a legend from the union of the regions' scale tables, hover through each mark's `hitNearest` over its layer's Flatbush, spans stacked on `row` into `rowCount` bands |

**Colour is resolved in exactly one place** — the worker — and the legend reads
the same table ([mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md)).
A categorical scale with a `domain` hands palette entries to the listed values
in that order and then to whatever else the region held, sorted; without one,
each value derives its entry from itself through `categoricalValueColor` (an
integer takes the slot it names, anything else hashes in), so two regions that
met different value sets agree on every value they share without a round trip,
and a feature with nothing in the field takes a grey `(no value)` row. That
was Manhattan's own evaluator until 2026-09-09; the encoder's per-region
palette walk was the one way two regions of a view could disagree about a
colour, and the reviewer's case against a view-level resolution instead was
that it either refetches on every union growth or rewrites colour per instance
on the main thread, which breaks the one-place rule above. A ramp reads the
field through `domain`, or the region's own extremes when none is listed, and
there `domain` is still what pins the answer across a view.

**A scale belongs to a channel, not to colour alone.** `glyph` takes the
same `{ field, scale: 'categorical', domain? }` that `color` does, with
`range` — glyph names, the three in order by default — where colour has
`palette`, and `encodeFeatures` resolves both through one categorical arm:
the walk records which distinct value each admitted instance carried and
`resolve` hands every value its range entry once the table is known, pinned
by `domain` or derived from the value. The payload carries `scale` for the
colour channel and `glyphScale` for the glyph channel, and the mark display's
legend draws a glyph table as rows whose swatch is the glyph — recorded from
render-core's own `appendGlyph` as SVG path data, so the key cannot draw a
triangle the plot draws as a disc. Only `point` reads the lane; a scale on a
bar's glyph resolves and is never drawn.

**A lane is filled because a shape reads it.** `encodeFeatures` takes the
lane set beside the encoding — `y`, `color`, `glyph`, `row`, and `index` for
the Flatbush — and a lane not named is neither allocated, filled nor
transferred: `EncodedChannels` carries every lane as optional on the wire,
`Encoded<L>` is the same type with a caller's own lanes required, and the
mark display's lens hands a shape its layer only when the lanes it reads
are there. The index is a lane like the others because it was most of the
cost after the walk — the `no-index` and `wiggle` rows below — and a caller
that never hovers through it (wiggle's fallback, the example plugin's
every-instance walk) declines it. A `jexl` instance is likewise passed only
by a caller with a `jexl:` channel to compile; every other channel is a
field name or a reader.

**A `jexl:` ref is a channel escape, not the default.** The measurement below
is why: the native read is the loop's own cost and a jexl evaluation is half
again on top of it per channel.

## The bar shape

`packages/render-core/src/marks/barMark.ts` and `shaders/barMark.slang`: a rect
from `x` to `x2` standing between `origin` and `y` on `valueScale.slang`'s
`valueToYPx`, the scale `pointMark` reads too — the composition
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
adopted, with [ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)'s
split kept: the scale is shared, the anchor (a glyph centre against a bar's
baseline) is each shape's own. The horizontal cuts antialias analytically as
wiggle's xyplot bar does; the vertical cuts stay hard because tiling intervals
split a pixel column, so the shader declares no `//! coverage: analytic`.
`drawAgainstHit.test.ts` sweeps it in both orientations, and a zero-height bar
neither paints nor answers.

## A reader in a channel's place

`encodeFeatures` takes a `MarkEncodingInput`: a `MarkEncoding` any channel of
which may be a `ChannelReader`, a `(feature) => value` built in the worker.
The declared form is what crosses the wire; the reader form is how a display's
own worker method reaches the one loop for a channel no field name can say.
Three packers moved onto it on 2026-09-09:

- **Manhattan** (`plugins/gwas/src/ManhattanRPC/executeGetManhattanData.ts`)
  is `encodeFeatures(features, { y: scoreField, color, glyph })` where `color`
  and `glyph` are the colouring mode's readers — a constant or `jexl:` colour
  through `colorEvaluator`, the field mode's value-hashed colour, or LD's
  join against the PLINK adapter — and `ManhattanRpcResult` is
  `EncodedChannels` plus `r2s` and `indexFound`. The r² channel is read after
  the encode over `featureIndex`, which is what that array is for. Field
  colouring is the declared `{ field, scale: 'categorical' }` and nothing
  else, once the encoder's unpinned scale derived colour from the value the
  way Manhattan's own evaluator had. Measured over a million
  features, min of 7: 208 → 221 ns/feature in normal mode, 223 → 251 in LD
  mode, the second the r² pass's re-derivation.
- **score-example** is `encodeFeatures(features, { y: scoreColumn })` and
  nothing else; its `[0, 1]` normalisation per region went, and the display
  folds the shipped `yMax` of every loaded region into one `[0, max]` domain
  the shape's `valueScale` uniform reads, so a box's height means the same in
  every region.
- **wiggle's array-less fallback** (`featuresToRaw`,
  `plugins/wiggle/src/util.ts`) is `encodeFeatures(features, { y })` where
  `y` is a reader over `scoreField` that plots a missing value at 0, as the
  slot documents, plus the summary `minScore`/`maxScore` band read over
  `featureIndex` afterwards, the way Manhattan reads r². The array fast path
  (BigWig, GC content) never materialises a `Feature` and stays as it is;
  `RawFeatureArrays` admits the encoder's `Uint32Array` beside the bbi
  `Int32Array`, and `processFeaturesFromArrays` copies either. Measured over
  a million `SimpleFeature`s, min of 7: 83 → 219 ns/feature, 91 → 263 with a
  summary band, and **the whole gap was the Flatbush** the encoder built for
  a hit index this packer discards. The fallback now names the `y` lane
  alone and passes no jexl instance — every channel it hands the encoder is
  a reader — and the `wiggle` row of the table below is that call.

## Prior art, read against the encoder on 2026-09-09

GenomeSpy (`~/src/vendor/genomespy`, a Vega-Lite dialect over WebGL for
genomics; `SESSION_SPEC_FORMAT.md` §"What the grammars do" has the census)
answers the same questions differently, and three of its answers are worth
knowing at this seam:

- **Scales resolve on the GPU.** A categorical attribute carries the category
  index and the colours sit in a range texture, so a re-palette touches no
  buffer — and its scale generator carries a note that WebGL treats those
  indices as fixed texture positions, so a domain cannot reorder or grow
  dynamically. The value-derived resolution above is this tree's answer to
  the same per-region problem, without a texture and with colour still
  resolved in one place.
- **A transform names its `type`.** GenomeSpy departed from Vega-Lite's
  inferred transform shape on purpose, for extensibility. A transform list on
  `CoreEncodeFeatures`, if one lands, takes that spelling, with `filters`
  folded in as the first member.
- **Semantic zoom is a layer property.** Its `multiscale` composition orders
  layers from zoomed-out to zoomed-in with `stops` and cross-fades by the zoom
  metric. `defineMark`'s `enabled(state)` and the tier mixins do that
  imperatively; a zoom range on a `marks` entry is the declared form.

What it has that the compile-time form deliberately does not: `size`,
`opacity` and `angle` as channels, from shaders generated at runtime from the
encoding (ADR-095 §"The grammar position").

## The jexl channel, measured

<!-- BEGIN GENERATED MEASUREMENT mark-encoding-jexl-channel -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm         |  features |  wall | per feature (ns) | vs native |
| ----------- | --------: | ----: | ---------------: | --------: |
| native      | 1,000,000 | 218ms |              218 |     1.00x |
| control     | 1,000,000 | 227ms |              227 |     1.04x |
| jexl-y      | 1,000,000 | 325ms |              325 | **1.49x** |
| jexl-color  | 1,000,000 | 416ms |              416 | **1.91x** |
| scale-color | 1,000,000 | 275ms |              275 | **1.26x** |
| jexl-glyph  | 1,000,000 | 387ms |              387 | **1.78x** |
| scale-glyph | 1,000,000 | 262ms |              262 | **1.20x** |
| no-index    | 1,000,000 |  81ms |               81 | **0.37x** |
| wiggle      | 1,000,000 |  67ms |               67 | **0.31x** |

<!-- END GENERATED MEASUREMENT mark-encoding-jexl-channel -->

The control row is the harness's resolution. The jexl rows are one
evaluation per feature over `buildJexlContext`'s proxy; the colour arm was
2.35x native before its CSS answers were parsed once per distinct string
rather than per feature, which is the cache `colorEvaluator` holds. The scale
rows are the same rule declared as a scale — a field read, a map lookup per
feature and one pass after the walk — and are why shape-by-field is a scale
on `glyph` rather than the jexl ternary it used to need. The last two rows
are what the lane set buys: `no-index` is the native encoding without its
Flatbush, and `wiggle` is the fallback packer's call.
