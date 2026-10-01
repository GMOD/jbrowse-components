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
level because the reader never picks a mark; this is the rung where a reader
does, for the one class where the format decides nothing (a BED score column, a
segment ratio, a bedGraph-shaped interval).

## The pieces

| Piece | Where | What it owns |
| --- | --- | --- |
| `MarkEncoding`, `encodeFeatures` | `packages/core/src/util/markEncoding.ts` | the declaration and its evaluation over the lanes the caller names: native `feature.get(field)` per channel, `jexl:` as the opt-in escape, and the `ScaleTable` per scaled channel |
| `runTransforms`, `layerTables` | `packages/core/src/util/featureTransforms.ts` | the transform stage: a typed step list run in order over a table ([ADR-191](../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md)); an adapter holding typed rows answers a `ColumnTable` through `getFeatureTable` ([ADR-193](../architecture-decision-records/adr-193-an-adapter-answers-the-mark-pipeline-its-typed-arrays.md)) |
| `CoreGetEncodedLayers` | `packages/core/src/rpc/methods/CoreGetEncodedLayers.ts` | one region's features fetched once, the shared `transform` run, then each layer's own `transform` and encoding; answers `{ layers: EncodedChannels[] }` index-aligned with the request, buffers transferred |
| `LinearMarkDisplay` | `plugins/marks` | the `marks` slot, one `defineMark` per entry reading `layers[markIndex]` through a lens that checks its lanes are present (`markLanes` over `MARK_SPECS`) and `enabled` inside the entry's zoom range; a `text` entry placed as DOM by `placeTextMarks`; the legend from the union of the regions' scale tables; hover through each mark's `hitNearest` |

Hover for a bar, rule, line or span goes by the rows near the cursor
(`rowSpanIndex`, [ADR-192](../architecture-decision-records/adr-192-a-span-answers-a-hover-by-its-row.md),
[ADR-196](../architecture-decision-records/adr-196-a-bar-answers-a-hover-by-its-row.md));
a point or link uses a Flatbush.

## Scales

**A positional channel is a field and the value scale is the plot's**, where
`color` and `shape` each carry their own scale object. The display's `scales.y`
(`type`, `domainMin`, `domainMax`, the autoscale members, and the `rules` and
`title` guides) is the one value scale. Every mark's `encoding.y` names a field
read through it, so the axis, ticks, reference lines and every mark's shapes read
one declaration and the score menu's "Set min/max" writes there
([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md),
[ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md)).
The scale does not cross the wire: nothing in the worker reads it, and shipping
it would key the fetch on the axis.

**Colour is resolved in exactly one place per cardinality**, and the legend reads
the same table ([mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md)).

- **Categorical.** Every value derives its entry from itself (`categoricalScale`,
  `packages/core/src/ui/colors.ts`: an integer takes the slot it names,
  anything else hashes in), so two regions that met different value sets agree
  on every shared value without a round trip. A feature with no value takes a
  grey `(no value)` row. A `domain` hands palette entries to the listed values
  in order, continuing into the default palette, and an unlisted value hashes
  into a slot no listed value holds nor one within 0.05 OKLab of a listed
  colour. Ranking unlisted values after listed ones gave one value two colours
  across a pan. A view-level resolution was rejected because it either refetches
  on every union growth or rewrites colour per instance on the main thread.
- **Which kind comes from `scale` alone**, never from the data or from which
  other member is written: a `field` with no `scale` is categorical whatever
  `range` lists. The table carries `numericKeys` for a numeric field with no
  scale, and the key prints a line naming `scale` once rows pass a handful.
- **Threshold.** Only ever declared: `domain` holds ascending cut points, `range`
  one colour more, and a value takes `range[thresholdIndex(value, domain)]`
  (`@jbrowse/core/util/thresholdScale`). A missing value paints the no-value
  grey and non-numeric text the misconfiguration grey, decided on the miss branch
  so the interval lookup stays an integer ([ADR-156](../architecture-decision-records/adr-156-the-feature-colour-takes-a-threshold.md)).
  It resolves per region in the worker like a categorical scale, and its table is
  its declaration plus two flags for keyless cases. `thresholdKeyEntries` derives
  the key rows for the mark display and Manhattan alike. Manhattan's LocusZoom r²
  bins are this scale over `field: 'ld'`.
- **Quantitative ramp.** Resolved on the main thread, like y. A caller whose shape
  reads the ramp names the `colorValue` lane, and the worker ships raw values plus
  the region's `extent`. The display unions loaded extents into one domain, and
  `bar`, `point` and `span` read it as three uniforms (`rampMode`, `rampMin`,
  `rampMax`) over the 256-entry LUT bound through `defineMark`'s `texture`
  (a `span` doing so makes a heatmap, ADR-113). A pan that widens the domain
  uploads no instance bytes. The value rides the colour lane reinterpreted: one
  4-byte slot carries a packed ABGR or the value's float32 bits (`colorBits`,
  `markColor.slang`'s `asfloat`). `text` keeps the worker-resolved lane because
  its labels are DOM. Canvas2D, which is also the SVG export, bakes packed
  colours once per domain change (`paintColors`). `domainMin` and `domainMax`
  each pin one end (`rampDomain`, `@jbrowse/core/util/colorRamp`); both pinned
  fixes a legend for a figure. `reverse` turns the stops round
  (`colorRampStops`) so direction is a member rather than a domain written
  high to low.

**A scale belongs to a channel, not to colour alone.** `shape` takes
`{ field, scale: 'categorical', domain? }` with `range` listing shape names (the
three, in order, by default), and `encodeFeatures` resolves both through one
arm, `paintCategories`. The payload carries `scale` for colour and `shapeScale`
for shape. The legend draws a shape table with the shape as swatch, recorded from
render-core's `appendGlyph` as SVG path data so the key cannot draw a triangle
the plot draws as a circle. The shape fills the `glyph` lane, which only `point`
reads; a scale on a bar's shape is never resolved and the rule list warns of it.

## Lanes

**A lane is filled because a shape reads it.** `encodeFeatures` takes the lane set
beside the encoding (`y`, `color`, `colorValue`, `glyph`, `row`, and `index` for
the Flatbush), and an unnamed lane is neither allocated, filled nor transferred.
`EncodedChannels` carries every lane optional on the wire and `Encoded<L>` makes
a caller's own lanes required. The index is a lane because it was most of the
cost after the walk (the `no-index` and `wiggle` rows below), so a caller that
never hovers through it declines it. The mark display names it for a point or
link alone. A `jexl` instance is passed only by a caller with a `jexl:` channel.

**A constant colour is one number, not a lane.** A CSS colour, the default
included, answers `color` as the packed ABGR itself, and
`encodedChannelTransferables` lists no buffer for it. A categorical, threshold,
ramp or `jexl:` colour stays a lane even when every instance takes one colour.
`colorAt` reads either spelling, and indexing `color` directly is a type error.
The GPU pack and Canvas2D each expand it once, so shaders never learn the
difference ([ADR-198](../architecture-decision-records/adr-198-a-constant-colour-rides-as-a-scalar.md)).

**The encoder fills a lane at a time.** One pass admits rows over `x`, `x2` and
`y` alone, and none runs when all three hold whole numbers; every other lane is
its own loop over the admitted rows with one composed index or none. A
`kept ? kept[k] : k` test per element ran 3-4x slower in V8, so each loop exists
once with the index and once without. `featureIndex` is absent where no row was
skipped; `featureIndexAt` reads either.

**A feature the encoder cannot place is counted, not lost.** A feature whose `x`,
`x2` or asked-for `y` is missing or not a number is left out of the arrays and
added to `skipped` beside `count`. The mark display and Manhattan sum both into a
`SkippedFeaturesIndicator` chip (display-kit), whose tooltip names the `y` field.
Without it a mistyped `scoreField` or `encoding.y` was an empty track with no
message.

**A `jexl:` ref is a channel escape, not the default.** The native read is the
loop's own cost and a jexl evaluation adds about half again per channel (the
table below).

## The transform stage

A layer's features are the region's, after the steps its `transform` names, run
in the worker before the encode. A step is typed by `type`, the spelling
GenomeSpy chose over Vega-Lite's inferred one, and `runTransforms` runs them in
order. The step types are `filter`, `formula`, `flatten`, `cells`, `bin`,
`aggregate`, `coverage`, `pileup` and `mate`; `featureTransforms.ts` and its tests
define each one's fields and outputs.

In config a step is one member of `MarkTransform`
(`plugins/marks/src/LinearMarkDisplay/markTransformConfigSchema.ts`), a
`ConfigurationSchemaUnion`: it names its `type`, takes only its own slots, and a
key of another step is refused at load. The display writes every slot of every
step onto the wire (`stepsOf`), so a step left at its defaults and the same step
written at them are one fetch; `model.test.ts` pins that. Three lists name the
step types (the union's keys, the wire's `TransformStep`, the rule list's
`StepSnapshot`), and the union's `satisfies` and
`markTransformConfigSchema.test.ts` fail when they disagree
([ADR-150](../architecture-decision-records/adr-150-a-transform-step-is-one-schema-per-type.md)).

Behaviours that fail silently:

- **`bin` writes over `start` and `end` on purpose.** An `aggregate` grouped by
  those two is then a density whose bars span the bins, with `x`/`x2` defaults
  untouched and `y: 'count'`.
- **Two defaults spare that restatement.** An `aggregate` with empty `groupby`
  takes the edges the last `bin` before it wrote, in its own list, the facet's
  or the display's, resolved where the display translates `marks` into the
  request. A mark with empty `encoding.row` reads the field the last `pileup`
  before its encode wrote, unless an `aggregate` or `coverage` after that pileup
  made features from nothing. That resolves in the worker (`layerFeatures`) so an
  RPC caller gets the display's row.
- **A `bin` by `field` counts a boundary-crossing feature where its `field`
  falls.** The `make-density` sidecar counts starts the same way, so the density
  tier and the fetched count agree.
- **A `bin` over `fields` is the interval case** ([ADR-197](../architecture-decision-records/adr-197-a-bin-cuts-an-interval-at-its-edges.md)):
  each piece carries the bin's edges and `overlap`, so an `aggregate` weighting a
  `mean` by `overlap` is a mean per base (the MAF display's identity behind
  `cells`, a BigWig tier's span-weighted mean). An interval `bin` followed at
  once by an `aggregate` grouped by its edges runs as one kernel.
- **`step: "auto"` resolves before the RPC** to the 1/2/5 rung above four pixels
  of bp and is keyed into the fetch, so only a zoom across a rung refetches
  ([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)).
- **`bin` is for adapters with no summary.** Wiggle's binning stays the adapter's,
  since a BigWig's zoom levels are computed at index time and a mark over a
  `QuantitativeTrack` reads the tier bbi picks (ADR-123, ADR-125). Over a BigWig
  `bin` bins tier rows.
- **`pileup` is a layout, not a measurement.** It makes a read pileup declarable:
  a `span` reading the `row` it wrote is what the packing canvas's `packRef` does
  by hand ([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)).
- **`formula` and `bin` answer the input's rows with new fields beside them**, so
  no feature's data is copied per step; `aggregate` and `coverage` answer typed
  lanes carrying only what they wrote.

**`facet` and `rows` are one split in the worker.** `CoreGetEncodedLayers` splits
the features on the request's `facet.field` and runs each layer's steps over each
section alone (`facetLayers`,
[ADR-130](../architecture-decision-records/adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md)).
The split is a counting sort placed as early as the shared steps allow
(`layerTables`, ADR-191), so a shared step after it must read a row and answer
rows in order without writing the field. The display sends its `facet`, or its
`rows.field` under the same name. The main thread lays the answer out as labelled
sections under chips (`facetLayout`) or one row per value in the tree sidebar's
arrangement (`rowsLayout`). `rows` takes no steps of its own, so `facet.transform`
with no facet field runs over the shared list. The row lane, `markRowHeightPx` and
`bandTops` are shared
([ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)).

**The shared `transform` runs first, then each layer's own**, so one fetch can
hold a binned count and the raw features. With `minBpPerPx` on the density and
`maxBpPerPx` on the features, one config is a multiscale picture (GenomeSpy's
`multiscale` layer, `defineMark`'s `enabled`). A mark outside its range is off for
draw, hover and highlight, and `markView` folds only drawing marks into the shared
y domain, legend, span row count and skipped chip. The worker still encodes every
layer per region; nothing is skipped by zoom before the RPC.

**Past the byte budget the picture is the sidecar's.** The display is byte-gated
and composes `DensityTierMixin`. Where the gate refuses the detail fetch, a mark
declaring `source: 'density'` draws the adapter's `densityAdapter` bins as its own
layer, and `rpcDataMap` answers that in the region store's place, so domain, axis,
legend, hover and SVG export take the paths features take. Every other mark is
empty there, a corner chip says so, and a bin opens nothing, since the read-back
is the download the gate refused. With no density mark drawing, the tier never
reads and the banner stands ([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)).

Step cost, per input feature, as the steps plus the native encode of their
output:

<!-- BEGIN GENERATED MEASUREMENT feature-transform-steps -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm          | features in | features out |  wall | per input feature (ns) | vs none |
| ------------ | ----------: | -----------: | ----: | ---------------------: | ------: |
| none         |   1,000,000 |    1,000,000 |  94ms |                     94 |   1.00x |
| filter       |   1,000,000 |      500,000 | 252ms |                    252 |   2.67x |
| formula      |   1,000,000 |    1,000,000 | 265ms |                    265 |   2.81x |
| flatten      |     250,000 |    1,000,000 | 283ms |                  1,132 |   3.00x |
| flatten-bin  |     250,000 |          300 | 290ms |                  1,160 |   3.07x |
| bin-count    |   1,000,000 |          300 |  89ms |                     89 |   0.95x |
| bin-mean     |   1,000,000 |          300 | 154ms |                    154 |   1.63x |
| coverage     |   1,000,000 |    1,200,000 | 380ms |                    380 |   4.02x |
| pileup       |   1,000,000 |    1,000,000 | 203ms |                    203 |   2.15x |
| bin-then-raw |   1,000,000 |    1,000,300 | 201ms |                    201 |   2.13x |

<!-- END GENERATED MEASUREMENT feature-transform-steps -->

A table's row view (`TableRow`) spells `get` as a prototype method. The
class-field arrow derived features used allocated a closure per instance, which
was most of the construction cost over a million features:

<!-- BEGIN GENERATED MEASUREMENT feature-getter-prototype -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                                      | class-field arrow | prototype method | prototype vs arrow |
| ---------------------------------------- | ----------------- | ---------------- | ------------------ |
| construct one derived feature per input  | 114ms             | 35ms             | 0.31x              |
| construct, then read two fields off each | 187ms             | 125ms            | 0.67x              |

<!-- END GENERATED MEASUREMENT feature-getter-prototype -->

The table does not show what the encode hands the GPU: `bin-count` uploads 300
instances where `none` uploads a million, which is the point of a density layer at
wide zoom.

## The bar shape

`packages/render-core/src/marks/barMark.ts` and `shaders/barMark.slang`: a rect
from `x` to `x2` standing between `origin` and `y` on `valueScale.slang`'s
`valueToYPxScaled`, the scale `pointMark` also reads. The scale is shared and the
anchor (a glyph centre against a bar's baseline) is each shape's own
([ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md),
[ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
Horizontal cuts antialias analytically; vertical cuts stay hard because tiling
intervals split a pixel column, so the shader declares no
`//! coverage: analytic`. `drawAgainstHit.test.ts` sweeps both orientations, and a
zero-height bar neither paints nor answers.

## A reader in a channel's place

`encodeFeatures` takes a `MarkEncodingInput`: a `MarkEncoding` any channel of
which may be a `ChannelReader`, a `(feature) => value` built in the worker. The
declared form crosses the wire; the reader form lets a display's own worker method
reach the one loop for a channel no field name can say. Callers today:

- **Manhattan** reads LD colouring from `ld` and `ld_role`, which `GWASAdapter`
  writes onto features when a fetch's `opts.ld` names the index SNP. The display
  declares its layers to `CoreGetEncodedLayers` and keeps no worker method.
- **score-example** is `encodeFeatures(features, { y: scoreColumn })`. The display
  folds every loaded region's shipped `yMax` into one `[0, max]` domain, so a
  box's height means the same in every region.
- **wiggle's array-less fallback** (`featuresToRaw`, `plugins/wiggle/src/util.ts`)
  passes `y` as a reader over `scoreField` that plots a missing value at 0, and
  reads the `minScore`/`maxScore` band through `featureIndexAt`. The array fast
  path (BigWig, GC content) never materialises a `Feature` and stays as it is.
  Naming only the `y` lane and no jexl instance matters: the encoder's Flatbush
  for a hit index this packer discards was the whole cost gap.

## Prior art: GenomeSpy

GenomeSpy (a Vega-Lite dialect over WebGL for genomics; `SESSION_SPEC_FORMAT.md`
§"What the grammars do" has the census) answers three of this seam's questions
differently:

- **Scales resolve on the GPU**, with categories as indices into a range texture,
  so a re-palette touches no buffer but a domain cannot reorder or grow
  dynamically. Value-derived resolution is this tree's answer, with colour still
  resolved in one place and no texture.
- **A transform names its `type`.** `CoreGetEncodedLayers` takes that spelling.
- **Semantic zoom is a layer property** (`multiscale`, cross-fading by zoom
  metric). A `marks` entry's `minBpPerPx`/`maxBpPerPx` is the declared form here,
  as a hard cut through `enabled(state)`.

GenomeSpy also has `size`, `opacity` and `angle` channels from shaders generated
at runtime, which the compile-time form deliberately lacks (ADR-095 §"The grammar
position").

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

The control row is the harness's resolution. The jexl rows are one evaluation per
feature over `buildJexlContext`'s proxy, and `colorEvaluator` caches CSS answers
per distinct string. The scale rows declare the same rule as a scale, which is why
shape-by-field is a scale on `shape` rather than a jexl ternary. `ramp-color` is
the worker indexing the LUT per feature and `ramp-value` keeps raw values for the
display to resolve (ADR-113); the second is cheaper and agrees across regions.
`no-index` is the native encoding without its Flatbush, and `wiggle` is the
fallback packer's call.

## The mark display over a BigWig, measured

<!-- BEGIN GENERATED MEASUREMENT mark-vs-wiggle-bigwig -->

_Generated by `pnpm autogen` — edit the source, not this block._

| file                 |       bp/px |        tier (bp) | rows | wiggle | control |  marks | marks vs wiggle | marks, bin + mean | table, bin over fields + weighted mean | mean-of-means error, mean |    max | weighted by overlap, mean |
| -------------------- | ----------: | ---------------: | ---: | -----: | ------: | -----: | --------------: | ----------------: | -------------------------------------: | ------------------------: | -----: | ------------------------: |
| volvox_microarray.bw |          64 |              raw |  500 | 0.05ms |  0.03ms | 0.08ms |           1.60x |            0.11ms |                                 0.11ms |                         — |      — |                         — |
| volvox_microarray.bw |         256 |  256 (synthetic) |  196 | 0.06ms |  0.05ms | 0.06ms |           1.00x |            0.08ms |                                 0.09ms |                     1.75% |  6.75% |                     0.23% |
| volvox_microarray.bw |         944 | 1024 (synthetic) |   49 | 0.04ms |  0.03ms | 0.05ms |           1.25x |            0.05ms |                                 0.06ms |                     4.63% | 12.25% |                     0.46% |
| volvox_microarray.bw |       3,478 |             3478 |   15 | 0.02ms |  0.02ms | 0.03ms |           1.50x |            0.03ms |                                 0.03ms |                     5.60% | 11.61% |                     1.42% |
| volvox_microarray.bw |      13,912 |            13912 |    4 | 0.02ms |  0.02ms | 0.03ms |           1.50x |            0.03ms |                                 0.03ms |                     1.39% |  1.39% |                     0.14% |
| volvox_microarray.bw |      55,648 |            55648 |    1 | 0.02ms |  0.02ms | 0.02ms |           1.00x |            0.03ms |                                 0.02ms |                     0.14% |  0.14% |                     0.14% |
| CD16_Mono.bw         |          32 |              raw |  124 | 0.08ms |  0.08ms | 0.11ms |           1.38x |            0.16ms |                                 0.16ms |                         — |      — |                         — |
| CD16_Mono.bw         |         113 |  128 (synthetic) |  244 | 0.10ms |  0.10ms | 0.13ms |           1.30x |            0.16ms |                                 0.18ms |                     0.79% |  4.25% |                     0.31% |
| CD16_Mono.bw         |         400 |              400 |  386 | 0.08ms |  0.08ms | 0.10ms |           1.25x |            0.15ms |                                 0.15ms |                     0.28% |  7.25% |                     0.28% |
| CD16_Mono.bw         |       1,600 |             1600 |  534 | 0.08ms |  0.08ms | 0.11ms |           1.38x |            0.15ms |                                 0.15ms |                     0.22% |  7.93% |                     0.12% |
| CD16_Mono.bw         |       6,400 |             6400 |  570 | 0.14ms |  0.14ms | 0.17ms |           1.21x |            0.20ms |                                 0.20ms |                     0.16% |  1.90% |                     0.11% |
| CD16_Mono.bw         |      25,600 |            25600 |  906 | 0.15ms |  0.14ms | 0.18ms |           1.20x |            0.23ms |                                 0.21ms |                     0.04% |  0.64% |                     0.04% |
| CD16_Mono.bw         |     102,400 |           102400 |  866 | 0.09ms |  0.09ms | 0.12ms |           1.33x |            0.18ms |                                 0.15ms |                     0.04% |  1.24% |                     0.03% |
| CD16_Mono.bw         |     409,600 |           409600 |  471 | 0.09ms |  0.08ms | 0.11ms |           1.22x |            0.15ms |                                 0.12ms |                     0.03% |  0.22% |                     0.02% |
| CD16_Mono.bw         |   1,638,400 |          1638400 |  136 | 0.08ms |  0.08ms | 0.09ms |           1.13x |            0.10ms |                                 0.10ms |                     0.03% |  0.26% |                     0.03% |
| CD16_Mono.bw         |   6,553,600 |          6553600 |   37 | 0.05ms |  0.05ms | 0.05ms |           1.00x |            0.06ms |                                 0.06ms |                     0.02% |  0.06% |                     0.01% |
| CD16_Mono.bw         |  26,214,400 |         26214400 |   11 | 0.03ms |  0.03ms | 0.03ms |           1.00x |            0.04ms |                                 0.03ms |                     0.01% |  0.01% |                     0.01% |
| CD16_Mono.bw         | 104,857,600 |        104857600 |    3 | 0.02ms |  0.02ms | 0.02ms |           1.00x |            0.02ms |                                 0.03ms |                     0.00% |  0.00% |                     0.00% |

<!-- END GENERATED MEASUREMENT mark-vs-wiggle-bigwig -->

Both paths read one tier, so the rows agree by construction and the bench checks
that before timing. The mark path's extra work over a screen of tier rows is the
`BigWigFeature` objects, the rxjs collect in `getFeaturesArray` and the `index`
lane's Flatbush (`no-index` prices it), and neither side is where a refetch spends
its time. No shape needs a BigWig fast path, and a `getFeaturesArray` override on
the adapter is declined on the same number.

The last three columns compare a binned mean off a tier with the raw section's
coverage-weighted mean (ADR-129). An unweighted `mean` counts each tier row once
in its start's bin, so a tier straddling the bins costs it most. A `bin` over
`fields: ['start', 'end']` with a `mean` weighted by `overlap` (ADR-197) cuts rows
at the bin edges: at volvox's 256 bp synthetic tier the average error falls from
1.75%<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.meanErrPct--> to
0.23%<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.weightedErrPct-->, and at
the coverage file's 128 bp tier from
0.79%<!--m:mark-vs-wiggle-bigwig.cd16-mono-bw-113-1.meanErrPct--> to
0.31%<!--m:mark-vs-wiggle-bigwig.cd16-mono-bw-113-1.weightedErrPct-->. The
remainder is the tier's own rounding, which only a `validCnt` could resolve;
`@gmod/bbi` keeps its count and the adapter's synthetic bins carry none.
