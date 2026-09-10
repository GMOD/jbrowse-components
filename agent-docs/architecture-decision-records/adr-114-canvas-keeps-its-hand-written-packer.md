---
status: Accepted
summary: "Canvas's packRenderArrays stays hand-written: it emits 29 typed arrays across three primitive families and the encoder has a channel for 12 of them, so the port is 17 new arbitrary-type lanes, and the same primitives through flatten plus encodeFeatures measured 3.11x the packer with only five lanes filled. The fan-out itself does land as a transform — `flatten` is the sixth TransformStep kind, one feature per element of an array-valued field, measured beside the others"
---

# ADR-114: Canvas keeps its hand-written packer, and the fan-out lands as `flatten`

## Status

Accepted (2026-09-10). Closes the last row of
[ADR-106](adr-106-a-display-declares-its-marks.md) §Consequences and
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md)'s "one
hand-written packer left". Extends
[ADR-112](adr-112-a-layer-owns-its-transform-and-its-zoom-range.md)'s step
list with a sixth kind.

## Context

Four packers that were hand-written spellings of `encodeFeatures` call it
now — the mark display, Manhattan, the example plugin and wiggle's array-less
fallback ([MARK_ENCODING.md](../reference/MARK_ENCODING.md) §"A reader in a
channel's place"). Canvas's `packRenderArrays`
(`plugins/canvas/src/RenderFeatureDataRPC/packRenderArrays.ts`) was the fifth,
and it is the odd one: a gene arrives as one feature and leaves as exons, CDS
segments, codon stripes, UTRs, intron lines and a strand arrow. The obvious
read is that the missing piece is a fan-out transform in front of the encoder.

## What the packer emits

Three primitive families, **29 typed arrays**, and the classification is what
decides the question:

| Family | Lane | Kind |
| --- | --- | --- |
| rect | `rectPositions` | a feature field for a box, derived geometry for a codon stripe (the amino acid's span) |
| rect | `rectYs`, `rectHeights` | layout result — `FeatureLayout.y`/`.height`, UTR-shrunk by `UTR_HEIGHT_FRACTION`, rescaled and row-offset again on the main thread |
| rect | `rectColors` | an encoding of a feature field, resolved by `boxColor` |
| rect | `rectColorClasses` | a **deferred** encoding: the theme class the main thread resolves, length zero when every colour was literal |
| rect | `rectStrands` | a feature field |
| rect | `rectDensityFade` | allocated here, valued by the main-thread layout |
| rect | `rectFeatureIndices` | the walk's own hit-index slot, not the input list's index |
| rect | `rectLabelRows`, `rectChildOrdinals` | layout structure — rows stacked above, and the isoform's ordinal in its gene |
| line | `linePositions` | derived geometry: the gaps between a transcript's children |
| line | `lineHeights` | the box the line rides on, so the renderer snaps to its drawn centre |
| line | `lineDirections` | derived: strand, gated by `displayDirectionalChevrons` |
| line | `lineYs`, `lineColors`, `lineColorClasses`, `lineFeatureIndices`, `lineLabelRows`, `lineChildOrdinals` | as the rect's |
| arrow | `arrowXs` | derived: `strand === 1 ? end : start` — a point, not a span |
| arrow | `arrowWidthsBp` | derived: `end - start`, carried in bp because the worker never sees `bpPerPx` |
| arrow | `arrowDirections` | derived: strand |
| arrow | `arrowYs`, `arrowHeights`, `arrowColors`, `arrowColorClasses`, `arrowFeatureIndices`, `arrowLabelRows`, `arrowChildOrdinals` | as the rect's |

**The encoder has a channel for twelve of the twenty-nine** — each family's
positions, `y` and colour, plus `row` standing in for the hit-index slot — and
none for the other seventeen. Those seventeen are `Float32` heights and
strands, `Int8` directions, `Uint8` colour classes and label rows, `Uint16`
child ordinals and `Uint32` widths and fades: not channels of a mark grammar
but a renderer's instance struct. Three more things do not survive the trip
either. The window filter is not the encoder's skip rule — it is half-open for
a real span and **closed at both ends for a degenerate one**, so a CRISPR cut
site or motif tick sitting on a region seam is kept. An arrow has no `x2`. And
the same walk that emits the primitives emits four side outputs keyed by the
`flatbushIdx` it assigns as it goes — `flatbushItems`, `subfeatureInfos`,
`floatingLabelsData`, `aminoAcidOverlay` — which no transform over features
can answer.

## Decision

- **`packRenderArrays` stays hand-written**, and GRAMMAR_OF_GRAPHICS.md keeps
  saying so with the reason attached.
- **The fan-out lands as a transform anyway.** `flatten` is the sixth
  `TransformStep` kind: one feature per element of an array-valued `field`
  (`subfeatures` by default), each reading the element's fields over the
  feature it came from, so an exon still knows its gene's name and strand.
  `index` writes the element's position, `keepEmpty` keeps a feature the
  field left with nothing. Two of them reach a gene's exons, and a `bin` and
  an `aggregate` behind them are exons per 10 kb.

## Measured

The packer against the two steps it sits behind, and against the same
primitives through `flatten` plus `encodeFeatures`
(`plugins/canvas/benches/packRenderArrays.bench.ts`, 20,000 genes, two
isoforms of eight CDS segments each, 700,000 primitives):

<!-- BEGIN GENERATED MEASUREMENT canvas-packer-vs-encoder -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm          | primitives |  wall | per primitive (ns) | vs pack |
| ------------ | ---------: | ----: | -----------------: | ------: |
| glyph-layout |    700,000 | 273ms |                390 |   2.73x |
| emit         |    700,000 | 517ms |                739 |   5.17x |
| pack         |    700,000 | 100ms |                143 |   1.00x |
| pack-control |    700,000 |  98ms |                140 |   0.98x |
| encode       |    700,000 | 311ms |                444 |   3.11x |

<!-- END GENERATED MEASUREMENT canvas-packer-vs-encoder -->

The encoder row is a **floor**: it fills five lanes of the twenty-nine, drops
the window filter and needed a span invented for the arrow family. At 3.11x
the packer for a fifth of the work, and with the packer already only 11% of
the worker's per-region compute against the emitters' 58%, the port cannot pay
for itself — it would move the region's cost up while adding seventeen lanes
to a vocabulary whose rule is that a lane exists because a *shape* reads it.

`flatten` itself, over a million output features
([MARK_ENCODING.md](../reference/MARK_ENCODING.md) §"The transform stage"):
216ms against the bare encode's 70ms, 3.08x, where `filter` is 2.92x and
`bin`-and-count 3.60x. It costs what its neighbours cost.

## Consequences

- The grammar's transform stage now has six step kinds, and the fan-out
  genomics asks for most — a gene's exons — is one of them.
- **`flatten` reaches the wire and not yet the config rung.** Any caller of
  `CoreEncodeFeatures` can send it today; `TRANSFORM_TYPES` in
  `plugins/marks/src/LinearMarkDisplay/configSchema.ts` is the one line that
  puts it in a `marks` entry, and it was left out of this change only because
  that file was moving under another hand. Until it lands there the step has
  no config-authored consumer, which is the weakest part of this ADR.
- The measurement table for the transform steps was re-taken whole, because
  the flatten arms' input list changed the heap the other arms ran in: a
  second million real `SimpleFeature`s put the untouched `coverage` row from
  427ms to 1000ms. The arms now share one feature list and the flatten arms
  read containers over it. **A fixture beside an arm is part of the arm.**
- Canvas's rect vocabulary (`startEnd`, `y`, `height`) stays the second
  channel vocabulary ADR-106 books as open. This ADR is the measurement
  saying it is not converged by moving the packer.

## Rejected alternatives

- **The whole packer as `flatten` plus a per-family `LayerRequest`.** 3.11x
  the hand packer with five of twenty-nine lanes filled, before the seventeen
  lanes with no channel, the window rule and the four side outputs the walk
  produces in the same pass.
- **Generic named lanes on `EncodedChannels`**, so a caller could ask for
  `height: Float32` and `childOrdinal: Uint16`. It answers the type problem
  and dissolves the rule that makes the encoder legible — a lane is a mark
  channel a shape reads, not a column a caller invented. Nothing but canvas
  would use them.
- **Splitting the rects family so codon stripes and boxes are separate
  layers.** More RPC layers, the same lanes, and the stripe's alternating
  phase is per CDS segment across exon boundaries, which a per-layer encode
  would have to re-derive.
- **`flatten` writing the element's fields under prefixed names**, Vega-Lite's
  `as`. The element is the feature after the step; prefixes would mean every
  downstream encoding re-spells `start` as `subStart`.
- **A `flatten` restricted to `Feature` elements.** A record array in a field
  is what a GFF attribute or a BED block list parses to, and one `SimpleFeature`
  per record is the cost only that path pays.
