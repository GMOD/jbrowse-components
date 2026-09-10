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
| `MarkEncoding`, `encodeFeatures` | `packages/core/src/util/markEncoding.ts` | the declaration and its evaluation over the **lanes** the caller names: native `feature.get(field)` per channel, `jexl:` as the opt-in escape, a `y` that is a field or a field with the scale it is read through, a colour that is a constant, a jexl expression, a categorical palette or a ramp over a domain, a glyph that is a name, a jexl expression or a categorical scale over the glyph names, an integer `row`, the `y` extremes, a Flatbush over `(x, y, x2, y)` when `index` is named, and the `ScaleTable` per scaled channel |
| `runTransforms` | `packages/core/src/util/featureTransforms.ts` | the transform stage: a typed step list — `filter`, `formula`, `flatten`, `bin`, `aggregate`, `coverage`, `stack` — run in order over a feature list, each step reading what the last answered |
| `CoreEncodeFeatures` | `packages/core/src/rpc/methods/CoreEncodeFeatures.ts` | one region's features fetched once, the request's shared `transform` steps run (the display's `jexlFilters` as `filter` steps), then each layer of the request — its own `transform`, an encoding and its lanes — run over that list; answers `{ layers: EncodedChannels[] }` with `layers[i]` for the request's `layers[i]`, the buffers transferred |
| `LinearMarkDisplay` | `plugins/marks` | a `marks` slot of `{ shape, encoding, transform, source, minBpPerPx, maxBpPerPx }` sub-schemas, one `defineMark` per entry reading `layers[i]` through a lens that checks its shape's lanes are present (`SHAPE_LANES`) and `enabled` inside the entry's zoom range, the wiggle-core score axis **resolved from the declared `encoding.y`**, a legend from the union of the regions' scale tables, hover through each mark's `hitNearest` over its layer's Flatbush, spans stacked on `row` into `rowCount` bands |

**A scale is declared on the channel it scales** — `y` takes `{ field, scale,
domain, resolve }` beside the bare field name, the way `color` and `glyph`
take their own — and the display resolves it rather than owning a second copy
([ADR-113](../architecture-decision-records/adr-113-one-scale-rule-in-one-place.md)).
`ScoreScaleMixin`'s `declaredValueScale` hook is where that lands: the mark
display answers it off the first mark drawing at this zoom whose `y` names a
field, so the axis, its ticks and the shapes read one declaration, and the
score menu's "Set min/max" writes back into it. The display's
own `minScore`/`maxScore`/`scaleType` slots are what a mark with no declared
`y` falls back to. **One mark may read its own axis**: `resolve:
'independent'` on its `y` folds a domain from its layers alone, hands its
shapes that domain through `markValueScale` — the one reader the shapes and
the hit test share — and declares a second `ValueScale` with `side: 'right'`,
which `DisplayChrome` and `renderDisplaySvg` place without knowing whose it is
([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)).
A second such mark is refused where the config is read.
For wiggle, the multi-wiggle, Manhattan and the coverage band those slots are
still the axis itself. The declared scale does not cross
the wire — the worker reads a value and nothing there reads the scale, and
shipping it would key the fetch on the axis.

**Colour is resolved in exactly one place per cardinality**, and the legend
reads the same table ([mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md)).
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
on the main thread, which breaks the one-place rule above.

A **quantitative** ramp resolves on the main thread instead, the way y does:
a caller whose shape reads the ramp itself names the `colorValue` lane and the
worker ships the raw values plus the region's own `extent`; the display unions
the extents of the loaded regions into one domain and `bar` and `point` read
it as three uniforms (`rampMode`, `rampMin`, `rampMax`) over the 256-entry LUT
bound through `defineMark`'s `texture`, so an unpinned ramp agrees across a
view and a pan that widens the domain uploads no instance bytes. The value
rides the colour lane reinterpreted — one 4-byte slot carrying either a packed
ABGR or the value's float32 bits, `colorBits` on the packing side and
`markColor.slang`'s `asfloat` on the shader's — so the ramp costs no instance
byte. The Canvas2D painters, which are also the SVG export, bake the packed
colours once per domain change (`paintColors`, memoized on the payload). A
`span` keeps the worker-resolved lane: its geometry is `rowRect`'s, whose
uniform struct four other displays share. A listed `domain` still pins, and is
what fixes a legend for a figure.

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
lane set beside the encoding — `y`, `color`, `colorValue`, `glyph`, `row`, and
`index` for the Flatbush — and a lane not named is neither allocated, filled nor
transferred: `EncodedChannels` carries every lane as optional on the wire,
`Encoded<L>` is the same type with a caller's own lanes required, and the
mark display's lens hands a shape its layer only when the lanes it reads
are there. The index is a lane like the others because it was most of the
cost after the walk — the `no-index` and `wiggle` rows below — and a caller
that never hovers through it (wiggle's fallback, the example plugin's
every-instance walk) declines it. A `jexl` instance is likewise passed only
by a caller with a `jexl:` channel to compile; every other channel is a
field name or a reader.

**A feature the encoder cannot place is counted, not lost.** A feature whose
`x`, `x2` or asked-for `y` reads as missing or not a number is left out of
the arrays and added to `skipped` beside `count`, and the mark display and
Manhattan sum the two over their loaded regions into a warning chip in the
bottom-right corner (`SkippedFeaturesIndicator` in display-kit, the same
`TrackControl` the height indicator uses for features the layout dropped):
"4 of 4 skipped", with the tooltip naming the `y` field. Before it, a
mistyped `scoreField` or `encoding.y` was an empty track with no message.

**A `jexl:` ref is a channel escape, not the default.** The measurement below
is why: the native read is the loop's own cost and a jexl evaluation is half
again on top of it per channel.

## The transform stage

A layer's features are the region's, after the steps its `transform` names,
run in the worker before the encode. The step list is typed by `type`, the
spelling GenomeSpy chose over Vega-Lite's inferred one, and `runTransforms`
walks it in order:

| Step | What it answers | Fields it writes |
| --- | --- | --- |
| `filter` | the features a `jexl:` expression admits | none |
| `formula` | every feature, with a `jexl:` expression's value in `as` | `as` |
| `flatten` | one feature per element of an array-valued `field` (`subfeatures`), reading the element's fields over the feature it came from | the element's, and `index` |
| `bin` | every feature, snapped to the genome-aligned bin of `step` bp its `field` (`start`) falls in; `step: "auto"` follows the view's zoom | `start` and `end`, or the two names in `as` |
| `aggregate` | one feature per distinct `groupby` value set, spanning its members' extent, with each of `ops` — `count`, or `sum`/`mean`/`min`/`max` over a field — in `as` or `count`/`<op>_<field>`; no `groupby` folds the region | the group's fields, the ops |
| `coverage` | one feature per run of constant depth over the spans, where the depth is not zero | `as` (`coverage`) |
| `stack` | every feature, on the lowest row where it overlaps nothing already there — greedy first fit in start order over `fields` (`start`, `end`), `padding` bp of clearance, `groupby` packing each group from row 0 | `as` (`row`) |

`bin` writes over `start` and `end` on purpose: an `aggregate` grouped by
those two is then a density whose bars span the bins, with the encoding's
`x`/`x2` defaults untouched and `y: 'count'`, and the group's extent is the
bin's. A feature is placed in one bin by one field; a feature that crosses
a boundary counts where its `field` falls, which is what `coverage` is for
when the question is overlap rather than count. A `formula` and a `bin`
answer a `DerivedFeature` reading the new fields over the old ones, so no
feature's data is copied per step; an `aggregate` or `coverage` answers a
`MadeFeature` carrying only what it wrote, with a lazy id. A `step` of
`"auto"` resolves before the RPC to the 1/2/5 rung above four pixels of bp and
is keyed into the fetch, so a bin is the same width of screen at every zoom
and only a zoom across a rung refetches
([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)).
Wiggle's binning is still the adapter's — a BigWig's zoom levels are computed at
index time and the mark display does not draw over `QuantitativeTrack`
(ADR-107) — so `bin` is for the feature adapters that have no summary.

`stack` is the one step whose output is a layout rather than a measurement,
and it is what makes a pileup declarable: a `span` reading the `row` it wrote
is the packing canvas's `packRef` does by hand, over any adapter the mark
display attaches to
([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)).
It answers a `DerivedFeature` over the input in start order, so nothing is
copied per feature and a later `bin` or `aggregate` still reads the original
fields.

The request's shared `transform` runs first, then each layer's own, so a
`marks` list can hold a binned count and the raw features over one fetch:
the display's `jexlFilters` are the shared steps and a mark's `transform`
its own. With a zoom range on each — `minBpPerPx` on the density,
`maxBpPerPx` on the features — one config is a multiscale picture, the
declared form of GenomeSpy's `multiscale` layer and of `defineMark`'s
`enabled`. A mark outside its range is off for the draw, the hover and the
highlight through `enabled`, and the display folds only the drawing marks
into the shared y domain, the legend, the span row count and the skipped
chip (`markVisible`), so the feature layer's axis is not blown out to the
count's range. The worker still encodes every layer per region: the bin
layer costs 300 instances at a million features, and the feature layer's
encode is the cost it was, so nothing is skipped by zoom before the RPC.

**Past the byte budget the picture is the sidecar's.** The display is
byte-gated and composes `DensityTierMixin`, so where the gate refuses the
detail fetch a mark declaring `source: 'density'` draws the adapter's
`densityAdapter` bins as its own layer — the sidecar's intervals as `x`/`x2`,
its levels as `y`, a Flatbush over the same box — and `rpcDataMap` answers
that in the region store's place, so the domain, the axis, the legend, the
hover and the SVG export are the paths the features already take. Every other
mark is empty there, a corner chip says the sidecar is what is drawn, and a
bin opens nothing, the read-back being the download the gate refused. With no
density mark drawing, the tier never reads and the banner stands
([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)).

Measured, per input feature, as the steps plus the native encode of their
output:

<!-- BEGIN GENERATED MEASUREMENT feature-transform-steps -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm          | features in | features out |  wall | per input feature (ns) | vs none |
| ------------ | ----------: | -----------: | ----: | ---------------------: | ------: |
| none         |   1,000,000 |    1,000,000 |  74ms |                     74 |   1.00x |
| filter       |   1,000,000 |      500,000 | 223ms |                    223 |   3.03x |
| formula      |   1,000,000 |    1,000,000 | 420ms |                    420 |   5.69x |
| flatten      |     250,000 |    1,000,000 | 217ms |                    868 |   2.94x |
| flatten-bin  |     250,000 |          300 | 412ms |                  1,648 |   5.58x |
| bin-count    |   1,000,000 |          300 | 252ms |                    252 |   3.41x |
| bin-mean     |   1,000,000 |          300 | 305ms |                    305 |   4.14x |
| coverage     |   1,000,000 |    1,599,999 | 425ms |                    425 |   5.76x |
| stack        |   1,000,000 |    1,000,000 | 374ms |                    374 |   5.07x |
| bin-then-raw |   1,000,000 |    1,000,300 | 335ms |                    335 |   4.55x |

<!-- END GENERATED MEASUREMENT feature-transform-steps -->

The jexl arms cost what the jexl channel does. The aggregate's first form
built a string key per feature and measured 2.5x the raw-value trie it
keys by now; its and coverage's outputs were `SimpleFeature`s and measured
1.9x the data-backed feature they are now. What the table does not show is
what the encode hands the GPU: `bin-count` uploads 300 instances where
`none` uploads a million, which is the whole point of a density layer at
wide zoom.

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
  inferred transform shape on purpose, for extensibility. `CoreEncodeFeatures`
  takes that spelling — `transform: [{ type: 'filter', expr }]`, run in order
  before the layers encode — and `filters: jexl[]` stays as sugar for leading
  filter steps.
- **Semantic zoom is a layer property.** Its `multiscale` composition orders
  layers from zoomed-out to zoomed-in with `stops` and cross-fades by the zoom
  metric. A `marks` entry's `minBpPerPx`/`maxBpPerPx` is the declared form
  here, a hard cut through `defineMark`'s `enabled(state)` rather than a
  cross-fade.

What it has that the compile-time form deliberately does not: `size`,
`opacity` and `angle` as channels, from shaders generated at runtime from the
encoding (ADR-095 §"The grammar position").

## The jexl channel, measured

<!-- BEGIN GENERATED MEASUREMENT mark-encoding-jexl-channel -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm         |  features |  wall | per feature (ns) | vs native |
| ----------- | --------: | ----: | ---------------: | --------: |
| native      | 1,000,000 | 249ms |              249 |     1.00x |
| control     | 1,000,000 | 252ms |              252 |     1.01x |
| jexl-y      | 1,000,000 | 373ms |              373 | **1.50x** |
| jexl-color  | 1,000,000 | 475ms |              475 | **1.91x** |
| scale-color | 1,000,000 | 315ms |              315 | **1.26x** |
| ramp-color  | 1,000,000 | 305ms |              305 | **1.22x** |
| ramp-value  | 1,000,000 | 259ms |              259 | **1.04x** |
| jexl-glyph  | 1,000,000 | 499ms |              499 | **2.01x** |
| scale-glyph | 1,000,000 | 300ms |              300 | **1.20x** |
| no-index    | 1,000,000 |  92ms |               92 | **0.37x** |
| wiggle      | 1,000,000 |  82ms |               82 | **0.33x** |

<!-- END GENERATED MEASUREMENT mark-encoding-jexl-channel -->

The control row is the harness's resolution. The jexl rows are one
evaluation per feature over `buildJexlContext`'s proxy; the colour arm was
2.35x native before its CSS answers were parsed once per distinct string
rather than per feature, which is the cache `colorEvaluator` holds. The scale
rows are the same rule declared as a scale — a field read, a map lookup per
feature and one pass after the walk — and are why shape-by-field is a scale
on `glyph` rather than the jexl ternary it used to need. The two ramp rows
are the same colour scale resolved on either side of the wire: `ramp-color`
is the worker indexing the LUT per feature, `ramp-value` is the walk keeping
the raw values for the display to resolve (ADR-113), and the second is
cheaper as well as being the one that agrees across regions. The last two
rows are what the lane set buys: `no-index` is the native encoding without
its Flatbush, and `wiggle` is the fallback packer's call.
