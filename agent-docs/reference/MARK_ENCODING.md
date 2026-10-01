---
name: mark-encoding
description: What rules and traps govern the declared encoding from feature fields to mark channels, the CoreGetEncodedLayers worker RPC, scale resolution and the transform stage? Read before adding a channel, scale or shape, or moving another packer onto the encoder.
kind: spec
---

# The mark encoding

A track config names marks and which feature fields feed each channel; one worker
call per region evaluates that and the display draws the result through the
shared shapes. [ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
§"The grammar position, as one ladder" explains why this rung exists only for the
quantitative class.

## Owners

| Piece | Where |
| --- | --- |
| `MarkEncoding`, `encodeFeatures`, `ScaleTable` | `packages/core/src/util/markEncoding.ts` |
| `runTransforms`, `layerTables` | `packages/core/src/util/featureTransforms.ts` ([ADR-191](../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md), [ADR-193](../architecture-decision-records/adr-193-an-adapter-answers-the-mark-pipeline-its-typed-arrays.md)) |
| `CoreGetEncodedLayers` | `packages/core/src/rpc/methods/CoreGetEncodedLayers.ts` |
| `LinearMarkDisplay` | `plugins/marks` |

Hover for a bar, rule, line or span goes by rows near the cursor (`rowSpanIndex`,
[ADR-192](../architecture-decision-records/adr-192-a-span-answers-a-hover-by-its-row.md),
[ADR-196](../architecture-decision-records/adr-196-a-bar-answers-a-hover-by-its-row.md));
a point or link uses a Flatbush.

## Scales

**A positional channel is a field and the value scale is the plot's.** The
display's `scales.y` is the one value scale; every mark's `encoding.y` names a
field read through it, and the score menu's "Set min/max" writes there
([ADR-141](../architecture-decision-records/adr-141-one-y-scale-the-displays.md),
[ADR-142](../architecture-decision-records/adr-142-one-value-scale-object.md)).
The scale never crosses the wire: shipping it would key the fetch on the axis.

**Colour resolves in exactly one place per cardinality**, and the legend reads the
same table ([mechanisms/rendering-decisions](../mechanisms/rendering-decisions.md)).

- **Which kind comes from `scale` alone**, never from the data or another member:
  a `field` with no `scale` is categorical whatever `range` lists.
- **Categorical** (`categoricalScale`, `packages/core/src/ui/colors.ts`): each
  value derives its entry from itself, so two regions that met different value
  sets agree without a round trip. Ranking unlisted values after listed ones gave
  one value two colours across a pan, and a view-level resolution either
  refetches on every union growth or rewrites colour per instance on the main
  thread; both are rejected.
- **Threshold** is only ever declared (`thresholdIndex`,
  `@jbrowse/core/util/thresholdScale`; [ADR-156](../architecture-decision-records/adr-156-the-feature-colour-takes-a-threshold.md)).
  `thresholdKeyEntries` derives the key rows for the mark display and Manhattan.
- **Quantitative ramp** resolves on the main thread, like y. The worker ships raw
  values (the `colorValue` lane) plus the region's `extent`, so a pan that widens
  the domain uploads no instance bytes (ADR-113). The value rides the colour lane
  reinterpreted (`colorBits`, `markColor.slang`'s `asfloat`). `text` keeps the
  worker-resolved lane because its labels are DOM. Canvas2D, which is also the
  SVG export, bakes colours once per domain change (`paintColors`).

**A scale belongs to a channel, not to colour alone.** `shape` takes
`{ field, scale: 'categorical' }` and resolves through the same arm,
`paintCategories`. The shape fills the `glyph` lane, which only `point` reads; a
scale on a bar's shape is never resolved and the rule list warns of it. The legend
records the swatch from render-core's `appendGlyph` so the key cannot draw a
triangle the plot draws as a circle.

## Lanes

**A lane is filled because a shape reads it.** `encodeFeatures` takes the lane set
beside the encoding, and an unnamed lane is neither allocated, filled nor
transferred. The Flatbush `index` is a lane because it was most of the cost after
the walk (the `no-index` and `wiggle` rows below): a caller that never hovers
through it declines it.

**A constant colour is one number, not a lane** ([ADR-198](../architecture-decision-records/adr-198-a-constant-colour-rides-as-a-scalar.md)).
Read colour through `colorAt`; indexing `color` directly is a type error.
`featureIndex` is absent where no row was skipped, so read it through
`featureIndexAt`.

**The encoder fills a lane at a time.** A `kept ? kept[k] : k` test per element
ran 3-4x slower in V8, so each loop exists once with the index and once without.

**A feature the encoder cannot place is counted, not lost.** A missing or
non-numeric `x`, `x2` or asked-for `y` lands in `skipped`, and the
`SkippedFeaturesIndicator` chip names the `y` field. Without it a mistyped
`scoreField` was an empty track with no message.

**A `jexl:` ref is a channel escape, not the default.** The table below prices it.

## The transform stage

A layer's features are the region's after the steps its `transform` names, run in
the worker before the encode. `featureTransforms.ts` and its tests define each
step's fields. In config a step is one member of `MarkTransform`
(`markTransformConfigSchema.ts`), a `ConfigurationSchemaUnion` that refuses another
step's key at load. The union's keys, the wire's `TransformStep` and the rule
list's `StepSnapshot` must agree, and the union's `satisfies` plus
`markTransformConfigSchema.test.ts` fail when they do not
([ADR-150](../architecture-decision-records/adr-150-a-transform-step-is-one-schema-per-type.md)).
`stepsOf` writes every slot of every step onto the wire so defaults and explicit
defaults are one fetch.

Behaviours that fail silently:

- **`bin` writes over `start` and `end` on purpose**, so an `aggregate` grouped by
  those two is a density whose bars span the bins.
- **Two defaults spare restating.** An `aggregate` with empty `groupby` takes the
  edges of the last `bin` before it. A mark with empty `encoding.row` reads the
  field the last `pileup` before its encode wrote, unless an `aggregate` or
  `coverage` after it made features from nothing (`layerFeatures`).
- **A `bin` by `field` counts a boundary-crossing feature where its `field` falls.**
  The `make-density` sidecar counts starts the same way, so the density tier and
  the fetched count agree.
- **A `bin` over `fields` is the interval case**
  ([ADR-197](../architecture-decision-records/adr-197-a-bin-cuts-an-interval-at-its-edges.md)):
  an `aggregate` weighting a `mean` by `overlap` is a mean per base.
- **`step: "auto"` resolves before the RPC** and is keyed into the fetch, so only
  a zoom across a rung refetches
  ([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)).
- **`bin` is for adapters with no summary.** Wiggle's binning stays the adapter's
  because a BigWig's zoom levels are computed at index time (ADR-123, ADR-125).
- **`pileup` is a layout, not a measurement**; a `span` reading the `row` it wrote
  replaces the packing canvas's `packRef`
  ([ADR-115](../architecture-decision-records/adr-115-one-mark-may-read-its-own-axis.md)).

**`facet` and `rows` are one split in the worker** (`facetLayers`,
[ADR-130](../architecture-decision-records/adr-130-a-facet-is-the-displays-and-splits-before-each-layers-steps.md),
[ADR-157](../architecture-decision-records/adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)).
The split is a counting sort placed as early as the shared steps allow, so a
shared step after it must read a row and answer rows in order without writing the
field. `rows` takes no steps of its own.

**The shared `transform` runs first, then each layer's own.** A mark outside its
`minBpPerPx`/`maxBpPerPx` range is off for draw, hover and highlight, but the
worker still encodes every layer per region; nothing is skipped by zoom before the
RPC.

**Past the byte budget the picture is the sidecar's.** Where the byte gate
refuses the detail fetch, a mark declaring `source: 'density'` draws the adapter's
`densityAdapter` bins, and every other mark is empty with a corner chip. With no
density mark drawing, the tier never reads and the banner stands (ADR-117).

Step cost, per input feature:

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

`TableRow` spells `get` as a prototype method; the class-field arrow derived
features used allocated a closure per instance:

<!-- BEGIN GENERATED MEASUREMENT feature-getter-prototype -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                                      | class-field arrow | prototype method | prototype vs arrow |
| ---------------------------------------- | ----------------- | ---------------- | ------------------ |
| construct one derived feature per input  | 114ms             | 35ms             | 0.31x              |
| construct, then read two fields off each | 187ms             | 125ms            | 0.67x              |

<!-- END GENERATED MEASUREMENT feature-getter-prototype -->

## The bar shape

`barMark.ts` and `shaders/barMark.slang` share `valueScale.slang`'s
`valueToYPxScaled` with `pointMark`; the anchor is each shape's own
([ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md),
[ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)).
Vertical cuts stay hard because tiling intervals split a pixel column, so the
shader declares no `//! coverage: analytic`.

## A reader in a channel's place

A channel of a `MarkEncodingInput` may be a `ChannelReader`, a `(feature) => value`
built in the worker, for a channel no field name can say. The declared form crosses
the wire; the reader form does not. Callers:

- **Manhattan** reads LD colouring from `ld` and `ld_role`, which `GWASAdapter`
  writes when a fetch's `opts.ld` names the index SNP.
- **score-example** folds every loaded region's shipped `yMax` into one `[0, max]`
  domain.
- **wiggle's array-less fallback** (`featuresToRaw`, `plugins/wiggle/src/util.ts`)
  passes `y` as a reader plotting a missing value at 0. Name only the `y` lane and
  no jexl instance: the encoder's Flatbush for a hit index this packer discards
  was the whole cost gap.

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

The control row is the harness's resolution. The scale rows declare the same rule
as a scale, which is why shape-by-field is a scale on `shape` rather than a jexl
ternary. `ramp-value` keeps raw values for the display to resolve (ADR-113); it is
cheaper than `ramp-color` and agrees across regions.

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

Both paths read one tier, so the rows agree by construction. The mark path's extra
work is the `BigWigFeature` objects, the rxjs collect in `getFeaturesArray` and the
`index` lane's Flatbush. No shape needs a BigWig fast path, and a
`getFeaturesArray` override on the adapter is declined on the same number.

The last three columns compare a binned mean off a tier with the raw section's
coverage-weighted mean (ADR-129). A `bin` over `fields: ['start', 'end']` with a
`mean` weighted by `overlap` (ADR-197) cuts the error at volvox's 256 bp synthetic
tier from 1.75%<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.meanErrPct--> to
0.23%<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.weightedErrPct-->, and at
the coverage file's 128 bp tier from
0.79%<!--m:mark-vs-wiggle-bigwig.cd16-mono-bw-113-1.meanErrPct--> to
0.31%<!--m:mark-vs-wiggle-bigwig.cd16-mono-bw-113-1.weightedErrPct-->. The
remainder is the tier's own rounding, which only a `validCnt` could resolve;
`@gmod/bbi` keeps its count and the adapter's synthetic bins carry none.
