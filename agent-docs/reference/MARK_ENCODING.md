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
| `MarkEncoding`, `encodeFeatures` | `packages/core/src/util/markEncoding.ts` | the declaration and its evaluation over the **lanes** the caller names: native `feature.get(field)` per channel, `jexl:` as the opt-in escape, a `y` that is a field, a colour that is a constant, a jexl expression, a categorical palette or a ramp over a domain, a shape that is a name, a jexl expression or a categorical scale over the shape names, an integer `row`, the `y` extremes, a Flatbush over `(x, y, x2, y)` when `index` is named, and the `ScaleTable` per scaled channel |
| `runTransforms` | `packages/core/src/util/featureTransforms.ts` | the transform stage: a typed step list — `filter`, `formula`, `flatten`, `bin`, `aggregate`, `coverage`, `pileup` — run in order over a feature list, each step reading what the last answered |
| `CoreEncodeFeatures` | `packages/core/src/rpc/methods/CoreEncodeFeatures.ts` | one region's features fetched once, the request's shared `transform` steps run (the display's `jexlFilters` as `filter` steps), then each layer of the request — its own `transform`, an encoding and its lanes — run over that list; answers `{ layers: EncodedChannels[] }` with `layers[i]` for the request's `layers[i]`, the buffers transferred |
| `LinearMarkDisplay` | `plugins/marks` | a `marks` slot of `{ mark, encoding, transform, source, minBpPerPx, maxBpPerPx }` sub-schemas, one `defineMark` per entry reading `layers[i]` through a lens that checks its type's lanes are present (`markLanes` over `MARK_SPECS`) and `enabled` inside the entry's zoom range, the wiggle-core score axis **resolved from the display's `scales.y`**, a legend from the union of the regions' scale tables, hover through each mark's `hitNearest` over its layer's Flatbush, spans stacked on `row` into `rowCount` bands |

**A positional channel is a field and the value scale is the plot's**, where
`color` and `shape` each carry their own scale object.
The display's own `scales.y` — `type`, `domainMin`, `domainMax`, the
autoscale members, and the two guides it owns, `rules` and `title` — is the one
value scale, and every mark's `encoding.y` names a field read through it, so
the axis, its ticks, its reference lines and every mark's shapes read one
declaration and the score menu's "Set min/max" writes there
([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md)).
`ScoreAxisMixin` is the contract it satisfies, and wiggle, Manhattan and the
coverage band declare the same object with the members each of them draws, `ScoreScaleMixin` reading and writing it
([ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md)). The scale does not cross
the wire — the worker reads a value and nothing there reads the scale, and
shipping it would key the fetch on the axis.

**Colour is resolved in exactly one place per cardinality**, and the legend
reads the same table ([mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md)).
Every value derives its entry from itself (`categoricalScale`,
`packages/core/src/ui/colors.ts`: an integer takes the slot it names, anything
else hashes in), so two regions that met different value sets agree on every
value they share without a round trip, and a feature with nothing in the field
takes a grey `(no value)` row. A `domain` hands palette entries to the listed
values in that order, continuing into the default palette past a short one, and
a value it leaves out hashes into a slot no listed value holds, nor one within
0.05 OKLab of a listed color; the legend lists the domain first and the rest
sorted. Ranking the unlisted values after the listed ones, as this did until
2026-09-17, gave one value two colors across a pan. That
was Manhattan's own evaluator until 2026-09-09; the encoder's per-region
palette walk was the one way two regions of a view could disagree about a
colour, and the reviewer's case against a view-level resolution instead was
that it either refetches on every union growth or rewrites colour per instance
on the main thread, which breaks the one-place rule above.

Which kind a colour scale is comes from `scale` and never from the data or
from which other member is written — a `field` with no `scale` is
`categorical`, whatever `range` lists — so a numeric field with no scale takes
a colour per distinct value; the table carries `numericKeys` for that case and
the key prints a line naming `scale` once the rows pass a handful.

A **threshold** scale is the third kind, and it is only ever declared: `domain`
is the ascending cut points, `range` holds one colour more, and a value takes
`range[thresholdIndex(value, domain)]` — the count of cut points it is at or
past (`@jbrowse/core/util/thresholdScale`). A feature with no value paints the
no-value grey and text that is no number the misconfiguration grey, the two
keys the feature display's threshold files (ADR-156), decided on the miss
branch alone so the interval lookup stays an integer. It resolves per region
in the worker the way a categorical scale does, so it needs no lane, no ramp
and no shader change, and the table it ships is its declaration, the cuts and
the `range` as written, with two flags for the keyless cases the region met;
`thresholdKeyEntries` derives the key's rows from those — interval labels
`< a`, `a – b`, `≥ b`, then the two keyless rows — for the mark display and
Manhattan alike, and the legend ORs the flags across regions and marks.
Manhattan's LocusZoom r²
bins are this scale over `field: 'ld'`, which is what makes them a config an
author can move.

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
uniform struct four other displays share. `domainMin` and `domainMax` each pin
one end and leave the other to that union (`rampDomain`,
`@jbrowse/core/util/colorRamp`), so a pinned floor holds across a pan while the
ceiling follows the data; both pinned is what fixes a legend for a figure. The
ramp's stops are `range`'s colours or the named `scheme`, turned round under
`reverse` (`colorRampStops`), so a direction is a member rather than a domain
written high to low.

**A scale belongs to a channel, not to colour alone.** `shape` takes the
same `{ field, scale: 'categorical', domain? }` that `color` does, with
`range` — shape names, the three in order by default — as colour's `range`
lists colours, and `encodeFeatures` resolves both through one categorical arm:
the walk records which distinct value each admitted instance carried and
`resolve` hands every value its range entry once the table is known, pinned
by `domain` or derived from the value. The payload carries `scale` for the
colour channel and `shapeScale` for the shape channel, and the mark display's
legend draws a shape table as rows whose swatch is the shape — recorded from
render-core's own `appendGlyph` as SVG path data, so the key cannot draw a
triangle the plot draws as a circle. The shape fills the `glyph` lane, the
point painter's code per instance, and only `point` reads it; a scale on a
bar's shape is never resolved, and the rule list warns of it.

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
| `flatten` | one feature per element of an array-valued `field` (`subfeatures`), reading the element's fields over the feature it came from; `keepEmpty` holds on to a feature whose array is empty, which is otherwise dropped | the element's, and `index` |
| `bin` | every feature, snapped to the genome-aligned bin of `step` bp its `field` (`start`) falls in; `step: "auto"` follows the view's zoom | `start` and `end`, or the two names in `as` |
| `aggregate` | one feature per distinct `groupby` value set, spanning its members' extent, with each of `ops` — `count`, or `sum`/`mean`/`min`/`max` over a field — in `as` or `count`/`<op>_<field>`; no `groupby` folds the region | the group's fields, the ops |
| `coverage` | one feature per run of constant depth over the spans, where the depth is not zero | `as` (`coverage`) |
| `pileup` | every feature, on the lowest row where it overlaps nothing already there — greedy first fit in start order over `fields` (`start`, `end`), `padding` bp of clearance | `as` (`row`) |

In config a step is one member of `MarkTransform`
(`plugins/marks/src/LinearMarkDisplay/markTransformConfigSchema.ts`), a
`ConfigurationSchemaUnion`: it names its `type` and takes only its own slots,
each defaulting to what the worker reads for a slot the wire leaves off, and a
key of another step is refused at load. The display writes every slot of every
step onto the wire (`stepsOf`), so a step left at its defaults and the same
step written at them are one fetch; `model.test.ts` pins that for every slot of
every step type. Three lists name the step types — the union's keys, the
wire's `TransformStep` and the rule list's `StepSnapshot` — and the union's
`satisfies` and `markTransformConfigSchema.test.ts` fail when they disagree
([ADR-150](../architecture-decision-records/adr-150-a-transform-step-is-one-schema-per-type.md)).

`bin` writes over `start` and `end` on purpose: an `aggregate` grouped by
those two is then a density whose bars span the bins, with the encoding's
`x`/`x2` defaults untouched and `y: 'count'`, and the group's extent is the
bin's. Two defaults spare the config that restatement. An `aggregate` whose
`groupby` is empty takes the edges the last `bin` before it wrote, in its own
list, the facet's or the display's, resolved where the display translates
`marks` into the request rather than in `runTransforms`. A mark whose
`encoding.row` is empty reads the field the last `pileup` before its encode
wrote — its own, the facet's per-section one, or the display's — unless an
`aggregate` or `coverage` after that pileup made its features from nothing,
resolved in the worker (`layerFeatures`) so a caller of the RPC gets the same
row a display does. A feature is placed in one bin by one field; a feature that crosses
a boundary counts where its `field` falls, which is what `coverage` is for
when the question is overlap rather than count. A `formula` and a `bin`
answer a `DerivedFeature` reading the new fields over the old ones, so no
feature's data is copied per step; an `aggregate` or `coverage` answers a
`MadeFeature` carrying only what it wrote, with a lazy id. A `step` of
`"auto"` resolves before the RPC to the 1/2/5 rung above four pixels of bp and
is keyed into the fetch, so a bin is the same width of screen at every zoom
and only a zoom across a rung refetches
([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)).
Wiggle's binning is still the adapter's: a BigWig's zoom levels are computed
at index time, and a mark over a `QuantitativeTrack` reads the tier bbi picks
for the view's zoom, the one the wiggle display reads (ADR-123, ADR-125). So
`bin` is for the feature adapters that have no summary, and over a BigWig it
bins tier rows; the table under "The mark display over a BigWig, measured"
says what that costs and how far it sits from the raw section.

`pileup` is the one step whose output is a layout rather than a measurement,
and it is what makes a read pileup declarable: a `span` reading the `row` it
wrote is the packing canvas's `packRef` does by hand, over any adapter the
mark display attaches to
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
chip (`markView`), so the feature layer's axis is not blown out to the
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
| pileup       |   1,000,000 |    1,000,000 | 374ms |                    374 |   5.07x |
| bin-then-raw |   1,000,000 |    1,000,300 | 335ms |                    335 |   4.55x |

<!-- END GENERATED MEASUREMENT feature-transform-steps -->

A step's derived feature spells `get` as a prototype method: the class-field
arrow it replaced allocated a closure per instance beside the object, and over
a million features that was most of the construction:

<!-- BEGIN GENERATED MEASUREMENT feature-getter-prototype -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                                      | class-field arrow | prototype method | prototype vs arrow |
| ---------------------------------------- | ----------------- | ---------------- | ------------------ |
| construct one derived feature per input  | 114ms             | 35ms             | 0.31x              |
| construct, then read two fields off each | 187ms             | 125ms            | 0.67x              |

<!-- END GENERATED MEASUREMENT feature-getter-prototype -->

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
`valueToYPxScaled`, the scale `pointMark` reads too — the composition
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
  is `encodeFeatures(features, { y: scoreField, color, shape: glyph })` where
  `color` and `glyph` are the colouring mode's readers — a constant or `jexl:` colour
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
  before the layers encode.
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
on `shape` rather than the jexl ternary it used to need. The two ramp rows
are the same colour scale resolved on either side of the wire: `ramp-color`
is the worker indexing the LUT per feature, `ramp-value` is the walk keeping
the raw values for the display to resolve (ADR-113), and the second is
cheaper as well as being the one that agrees across regions. The last two
rows are what the lane set buys: `no-index` is the native encoding without
its Flatbush, and `wiggle` is the fallback packer's call.

## The mark display over a BigWig, measured

<!-- BEGIN GENERATED MEASUREMENT mark-vs-wiggle-bigwig -->

_Generated by `pnpm autogen` — edit the source, not this block._

| file                 |       bp/px |        tier (bp) | rows | wiggle | control |  marks | marks vs wiggle | marks, bin + mean | mean-of-means error, mean |    max | span-weighted, mean |
| -------------------- | ----------: | ---------------: | ---: | -----: | ------: | -----: | --------------: | ----------------: | ------------------------: | -----: | ------------------: |
| volvox_microarray.bw |          64 |              raw |  500 | 0.12ms |  0.10ms | 0.32ms |           2.67x |            0.55ms |                         — |      — |                   — |
| volvox_microarray.bw |         256 |  256 (synthetic) |  196 | 0.12ms |  0.09ms | 0.17ms |           1.42x |            0.25ms |                     1.75% |  6.75% |               1.75% |
| volvox_microarray.bw |         944 | 1024 (synthetic) |   49 | 0.08ms |  0.07ms | 0.12ms |           1.50x |            0.13ms |                     4.63% | 12.25% |               4.63% |
| volvox_microarray.bw |       3,478 |             3478 |   15 | 0.05ms |  0.05ms | 0.07ms |           1.40x |            0.08ms |                     5.60% | 11.61% |               5.36% |
| volvox_microarray.bw |      13,912 |            13912 |    4 | 0.04ms |  0.04ms | 0.06ms |           1.50x |            0.07ms |                     1.39% |  1.39% |               0.14% |
| volvox_microarray.bw |      55,648 |            55648 |    1 | 0.04ms |  0.04ms | 0.06ms |           1.50x |            0.06ms |                     0.14% |  0.14% |               0.14% |
| CD16_Mono.bw         |          32 |              raw |  124 | 0.16ms |  0.15ms | 0.25ms |           1.56x |            0.42ms |                         — |      — |                   — |
| CD16_Mono.bw         |         113 |  128 (synthetic) |  244 | 0.19ms |  0.19ms | 0.30ms |           1.58x |            0.45ms |                     0.79% |  4.25% |               0.46% |
| CD16_Mono.bw         |         400 |              400 |  386 | 0.17ms |  0.16ms | 0.28ms |           1.65x |            0.56ms |                     0.28% |  7.25% |               0.28% |
| CD16_Mono.bw         |       1,600 |             1600 |  534 | 0.17ms |  0.17ms | 0.32ms |           1.88x |            0.74ms |                     0.22% |  7.93% |               0.18% |
| CD16_Mono.bw         |       6,400 |             6400 |  570 | 0.25ms |  0.24ms | 0.42ms |           1.68x |            0.65ms |                     0.16% |  1.90% |               0.11% |
| CD16_Mono.bw         |      25,600 |            25600 |  906 | 0.24ms |  0.24ms | 0.45ms |           1.88x |            0.64ms |                     0.04% |  0.64% |               0.04% |
| CD16_Mono.bw         |     102,400 |           102400 |  866 | 0.16ms |  0.16ms | 0.38ms |           2.38x |            0.73ms |                     0.04% |  1.24% |               0.04% |
| CD16_Mono.bw         |     409,600 |           409600 |  471 | 0.17ms |  0.17ms | 0.35ms |           2.06x |            0.77ms |                     0.03% |  0.22% |               0.03% |
| CD16_Mono.bw         |   1,638,400 |          1638400 |  136 | 0.14ms |  0.13ms | 0.18ms |           1.29x |            0.21ms |                     0.03% |  0.26% |               0.03% |
| CD16_Mono.bw         |   6,553,600 |          6553600 |   37 | 0.08ms |  0.08ms | 0.11ms |           1.38x |            0.11ms |                     0.02% |  0.06% |               0.02% |
| CD16_Mono.bw         |  26,214,400 |         26214400 |   11 | 0.05ms |  0.05ms | 0.07ms |           1.40x |            0.07ms |                     0.01% |  0.01% |               0.01% |
| CD16_Mono.bw         | 104,857,600 |        104857600 |    3 | 0.04ms |  0.04ms | 0.05ms |           1.25x |            0.06ms |                     0.00% |  0.00% |               0.00% |

<!-- END GENERATED MEASUREMENT mark-vs-wiggle-bigwig -->

Both paths read one tier now, so the rows agree by construction and the
bench checks it before it times anything. A screen of tier rows is hundreds
to a thousand, and the mark path's work over them is between one and three
times the hand path's and under half a millisecond in every row: the
difference is `BigWigFeature` objects and the rxjs collect in
`getFeaturesArray`, and the Flatbush the `index` lane builds, which
`no-index` in the table above prices. Neither side's work is where a refetch
spends its time, so no shape needs a BigWig fast path, and a
`getFeaturesArray` override on the adapter is declined on the same number.
The last three columns are the reading a `bin: auto` plus `aggregate: mean`
gives off a tier: a mean of tier means, unweighted, sits within a third of a
percent of the raw section's coverage-weighted mean on average over the
coverage file's own tiers and within 0.8 over its synthetic one (ADR-129), and
within a few percent over volvox's tiers, with the worst bin inside thirteen
percent; a span-weighted mean, which is what a `validCnt` would buy on data
this dense, moves the average by a third of a point at most. `@gmod/bbi` keeps
its count, and the adapter's synthetic bins carry none either.
