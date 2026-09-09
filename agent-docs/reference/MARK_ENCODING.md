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
| `MarkEncoding`, `encodeFeatures` | `packages/core/src/util/markEncoding.ts` | the declaration and its evaluation: native `feature.get(field)` per channel, `jexl:` as the opt-in escape, a colour that is a constant, a jexl expression, a categorical palette or a ramp over a domain, a glyph that is a name, a jexl expression or a categorical scale over the glyph names, the `y` extremes, a Flatbush over `(x, y, x2, y)`, and the `ScaleTable` per scaled channel |
| `CoreEncodeFeatures` | `packages/core/src/rpc/methods/CoreEncodeFeatures.ts` | one region's features fetched once, the `jexlFilters` applied, every encoding of the request run over the same list; answers `{ layers: EncodedChannels[] }` with `layers[i]` for `encodings[i]`, the buffers transferred |
| `LinearMarkDisplay` | `plugins/marks` | a `marks` slot of `{ shape, encoding }` sub-schemas, one `defineMark` per entry reading `layers[i]`, the wiggle-core score axis, a legend from the union of the regions' scale tables, hover through each mark's `hitNearest` over its layer's Flatbush |

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
  summary band. **The whole gap is the Flatbush** the encoder builds for a hit
  index this packer discards — with that block skipped the loop is 80 → 82 —
  so the encoder wants a way to decline it; until then the fallback pays
  ~136 ns/feature for an index nothing reads. Every channel wiggle hands the
  encoder is a reader, so the `jexl` in its context is an instance that
  refuses to compile, which a context that made `jexl` optional would retire.

## The jexl channel, measured

<!-- BEGIN GENERATED MEASUREMENT mark-encoding-jexl-channel -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm         |  features |  wall | per feature (ns) | vs native |
| ----------- | --------: | ----: | ---------------: | --------: |
| native      | 1,000,000 | 288ms |              288 |     1.00x |
| control     | 1,000,000 | 317ms |              317 |     1.10x |
| jexl-y      | 1,000,000 | 426ms |              426 | **1.48x** |
| jexl-color  | 1,000,000 | 485ms |              485 | **1.68x** |
| scale-color | 1,000,000 | 366ms |              366 | **1.27x** |
| jexl-glyph  | 1,000,000 | 507ms |              507 | **1.76x** |
| scale-glyph | 1,000,000 | 365ms |              365 | **1.27x** |

<!-- END GENERATED MEASUREMENT mark-encoding-jexl-channel -->

The control row is the harness's resolution. The jexl rows are one
evaluation per feature over `buildJexlContext`'s proxy; the colour arm was
2.35x native before its CSS answers were parsed once per distinct string
rather than per feature, which is the cache `colorEvaluator` holds. The scale
rows are the same rule declared as a scale — a field read, a map lookup per
feature and one pass after the walk — and are why shape-by-field is a scale
on `glyph` rather than the jexl ternary it used to need.
