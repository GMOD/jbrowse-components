---
status: Accepted
summary: "Audited every place a format-typed display assigns rows, counts per bin or computes depth, against the seven transform steps. Exactly one runs a rule a step reproduces — a plain uncapped single-region pileup is `stack` with `padding: 2`, pinned by a test — and porting it measured 4.23x, all of which is the `Feature[]` the step reads and answers rather than the packing. Every other packer's extra inputs are the display's meaning: label widths, isoform caps, row caps, per-refName grouping across regions, a layout seeded from the previous frame. No display calls a step; the grammar's transform stage stays the mark display's, and the mark display stops widening"
---

# ADR-118: The display packers share a rule with `stack`, not a step

## Status

Accepted (2026-09-10). Answers for the transform stage the question
[ADR-114](adr-114-canvas-keeps-its-hand-written-packer.md) answered for the
encoder, and settles
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md)'s open reading of
[ADR-115](adr-115-one-mark-may-read-its-own-axis.md) — that `stack` "is the
packing canvas's `packRef` does by hand".

## Context

`runTransforms` (`packages/core/src/util/featureTransforms.ts`) has seven step
kinds — `filter`, `formula`, `flatten`, `bin`, `aggregate`, `coverage`,
`stack` — and one consumer, the mark display
([ADR-112](adr-112-a-layer-owns-its-transform-and-its-zoom-range.md),
ADR-114, ADR-115). Three of those steps say something the format-typed
displays also say: `stack` assigns rows to intervals, `bin` and `aggregate`
count per bin, `coverage` measures overlap depth. If a display's own code is
one of those steps, calling the step deletes the code and the grammar is a
mechanism for this tree rather than a second way to draw. If it is not, the
mark display should stop widening and say why.

## The audit

Every place in the tree that assigns a row to an interval, bins a position or
measures depth, classified as (a) a rule a step reproduces exactly, (b) the
same rule with inputs the step lacks, or (c) something else.

| Where | Lines | What it runs | Class |
| --- | --- | --- | --- |
| `plugins/alignments/src/RenderAlignmentDataRPC/sortLayout.ts` `computeLayout` | 585–656 | plain uncapped single region: canonical order, then first fit with clearance 2 — **`stack` with `padding: 2`, row for row** | **(a)** |
| the same file's other paths — `placeRectCapped`, `computeSortedLayout`, `computeMultiRegionLayout` | 340–352, 657–704, 817–962 | a `maxRows` cap with a truncation sentinel; the reads a position sort ranks placed first; each read's extent unioned across regions on a per-refName placement axis | (b) |
| the same file's placement orders — soft-clip expansion, largest-first, spliced-first | 99–130, 457–529 | the comparator is a display setting, and soft clipping widens the interval the packer sees | (b) |
| `plugins/alignments/src/LinearAlignmentsDisplay/computeChainLayout.ts` `buildChainRowMap` | 38–69 | first fit over chains merged by name across regions, ordered by packing distance rather than start | (b) |
| `plugins/canvas/src/LinearBasicDisplay/packRef.ts` `packPreparedRef` | 443–512 | first fit in screen px through `GranularRectLayout`: per-feature heights, its own 10000px `maxHeight` | (b) |
| the same file's inputs — label reservations, strand-arrow padding, isoform trims, priority order, pile reservations | 48–71, 253–294, 329–394, 398–441 | the packed extent is widened by the label that will overhang it and the arrow that will draw past it; the insertion order is pinned features, then last frame's row; a collapsed pile is booked out of row 0 | (b) |
| `plugins/canvas/src/LinearBasicDisplay/layout.ts` | 33–87, 222–301 | regions grouped by refName so a feature crossing a block seam packs once, and a layout instance that persists across renders and seeds from the previous rows | (b) |
| `plugins/canvas/src/LinearBasicDisplay/densityCollapse.ts` | 95–174 | a sweep-line depth counter in screen px, per committed row, answering which ids sit in a pile ≥ 3 deep | (b) vs `coverage` |
| `packages/alignments-core/src/coverageCompute.ts` | 25–187 | per-base depth as a difference array, with deletion and skip events subtracting and forward and reverse filled in the same walk | (b) vs `coverage` |
| `packages/alignments-core/src/densityBins.ts` `densityToUniformBins` | 23–61 | an area-weighted resample: an interval spanning three bins contributes to all three, and the bin width follows `bpPerPx` | (b) vs `bin` + `aggregate` |
| `plugins/canvas/src/MultiRowClusterFeaturesRPC/buildMultiRowMatrix.ts` | 32–140 | pixel bins with last-covering-wins, the clustering matrix's columns | (b) vs `bin` |
| `plugins/canvas/src/RenderFeatureDataRPC/glyphs/subfeatures.ts` `layoutSubfeatures` | 247–345 | one row per isoform whatever the overlap, ranked and of variable height — a tier, not a packing | (c) |
| `plugins/alignments/src/LinearAlignmentsDisplay/spanOverlaps.ts` | 23–63 | a position covered by `d` spans emitted `d − 1` times, deliberately not deduplicated, so stacked alpha tints carry the depth | (c) |
| `plugins/alignments/src/LinearAlignmentsDisplay/collapsedLayout.ts` | 62–80 | row 0 for everything; there is no placement pass | (c) |
| `plugins/variants/src/shared/placeVariantRows.ts` | 32–49 | a permutation from worker row to screen row — a row is a sample | (c) |
| `plugins/canvas/src/MultiRowGetFeaturesRPC/packMultiRowFeatures.ts` | 202–296 | a row is a partition value, interned in first-seen order | (c) |
| `plugins/alignments/src/features/sashimi/junctions.ts` | 256–339 | greedy two-colouring into an up band and a down band, heaviest junction first, per refName | (c) |
| `plugins/arc/src/shared/arcLayout.ts` `layOutArcs` | 132–184 | no lane assignment at all: arcs overlap and the height is a jexl slot | (c) |
| `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneStack.ts` | 22–73 | a lane is a genome and the height is divided between them; dotplot places by 2D coordinate | (c) |
| `packages/wiggle-core/src/autoscale.ts` | 253–300 | a 1024-bucket histogram of *values* for the autoscale quantiles; positional binning is the adapter's (ADR-107) | (c) |
| `plugins/gwas/src/LinearManhattanDisplay/ldBins.ts` | 15–60 | r² thresholds bucketed to colours — a scale, not a transform. **Manhattan has no positional binning**; every record is an instance | (c) |
| `packages/display-kit/src/DensityTierMixin.ts`, `BaseFeatureDataAdapter.getFeatureDensity` | 42–118, 199–229 | reads a sidecar's precomputed bins and copies them into typed arrays; nothing bins | (c) |

One (a), and it is one path of one function.

## Decision

- **No display calls a transform step.** The packers stay where they are.
- **The convergence that exists is a rule, and it is pinned as one.**
  `stack` and `placeRect` (`packages/core/src/util/layouts/placeRect.ts`) are
  the same greedy first fit, `placeRect`'s hardcoded clearance being what the
  step spells as `padding: 2`, and
  `packages/core/src/util/featureTransforms.test.ts` holds the two to each
  other over 500 spans five rows deep rather than describing them as agreeing.
  A drift in either is a red test.
- **`stack` gains no `maxRows`, no comparator and no cross-region grouping.**
  Each would be added for a consumer that cannot use it anyway, for the reason
  the measurement gives.
- **GRAMMAR_OF_GRAPHICS.md stops reading ADR-115 as a convergence.** `stack`
  makes a pileup declarable over any adapter the mark display attaches to; it
  does not make the alignments pileup declarable, and the two sentences are
  not the same sentence.

## Measured

Alignments' `computeLayout` on its plain path against the same packing through
`runTransforms` (`plugins/alignments/benches/pileupLayoutVsStack.bench.ts`,
200,000 reads of 150bp over 600,000bp, 50 rows deep). The bench checks the two
row assignments against each other and refuses to time them if they disagree:

<!-- BEGIN GENERATED MEASUREMENT pileup-layout-vs-stack -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm      |   reads |   wall | per read (ns) | vs layout |
| -------- | ------: | -----: | ------------: | --------: |
| layout   | 200,000 | 10.3ms |            52 |     1.00x |
| control  | 200,000 | 10.6ms |            53 |     1.02x |
| stack    | 200,000 | 43.8ms |           219 |     4.23x |
| step     | 200,000 | 28.2ms |           141 |     2.72x |
| features | 200,000 | 12.5ms |            63 |     1.21x |

<!-- END GENERATED MEASUREMENT pileup-layout-vs-stack -->

**The packing is not what costs — the `Feature[]` on both sides of it is.**
`features` alone is 1.21x, so materialising a `SimpleFeature` per read costs
more than the whole of today's layout before the step has run; and `step`, the
shared step over a list already built, is another 2.72x on top of nothing, all
of it a `DerivedFeature` allocated per read and a `get('row')` asked of each
one on the way back out. A pileup is a `Uint32Array` of positions from the
worker and a `Uint16Array` of rows every downstream pass indexes by read.
Neither end of that is what `runTransforms` reads or answers, and the two ends
are the whole of the 4.23x — the same boundary ADR-114 found on the encoder
side at 3.11x, met from the other direction.

## Consequences

- The mark display's step list is complete for what the mark display draws.
  A new step kind now needs a `marks` config that wants it, not a display
  whose code it resembles.
- `stack`'s limits stay honest and stay small: it packs one region, in start
  order, uncapped. ADR-115 already booked the block-seam limit; this ADR is
  why the other three are not worth lifting.
- The grammar's claim at the transform stage is what it was — a config can
  declare a density, a coverage or a pileup over any feature adapter — and not
  a claim about the format-typed displays' layout. SESSION_SPEC_FORMAT.md
  §"The assessment" inferred that a rewrite as marks plus transforms "would
  move that layout into named `pileup`, `coverage` and `flattenCigar`
  transforms". It would move the *rule*; the audit above is the list of what
  would be left behind.
- The one thing the two hand-written first-fit primitives in core do share is
  now tested rather than commented.

## Rejected alternatives

- **Porting `computeLayout`'s plain path to `stack`.** The only (a) in the
  audit, and the measurement is above: 4.23x, for a path the display reaches
  only when one region is visible with no sort, no soft clipping and no row
  cap — so the port would be a second layout implementation living beside the
  one that still has to answer every other case.
- **A `maxRows` cap on `stack`.** One scalar, and it is the alignments cap's
  shape (`placeRectCapped`'s sentinel row). It would let no consumer call the
  step: the cap arrives with `ceilingCap`/`overrideCap` resolution over the
  viewport slice and a lane drag (`groupLayout.ts` 99–133, 610–632), which is
  main-thread display state a worker step is never told.
- **A comparator on `stack`.** ADR-115 already refused a `pileup` step fusing
  a sort, on the ground that sort order is a display question and baking one
  into a worker step keys the fetch on it. The audit adds that every first-fit
  caller in the tree installs a *total* order — `compareReadsCanonically`,
  `compareChainsCanonically`, `byPackPriority` — because first fit is
  arrival-order sensitive and JS sort is stable, so the member would have to
  be a full comparator and not a field name.
- **A second step kind, `layout`, taking label widths.** It would be honest
  only if the widths were data. They are not: a label's width is
  `measureText` at the display mode's font size against the display's
  decimation policy and its `labelRoomFactor` probe, which the fit ladder
  solves by packing the same region about ten times
  (`fitLadder.ts` 176–204). A step taking a per-feature width in px would be
  canvas's packer with the display's inputs passed through it — the display's
  code under a new name, in the worker, where the font size is not known.
- **A `groupby` over refName so `stack` could pack across regions.** `stack`
  has `groupby` already and it is not the missing piece: canvas groups
  *regions* before packing (`layout.ts` 33–87) and alignments lays refNames
  end to end on a synthetic axis (`refNameAxisShift`, `sortLayout.ts`
  773–789), both of which need the region list. A worker step sees one region
  and cannot.
- **An area-weighted `bin`, so `densityToUniformBins` could call it.**
  `bin` places a feature in one bin by one field on purpose (ADR-112), and
  the density band's bin width follows `bpPerPx`, which ADR-112 declined for
  the reason it gave — it keys the fetch on the zoom. The two would have to
  land together for one consumer that reads a sidecar's bins rather than
  features.
- **`coverage` gaining gap events, so `computeCoverage` could call it.** The
  events are CIGAR deletions and skips with their own strands, the output is a
  per-base `Float32Array` feeding a GPU buffer, and the sweep fills total,
  forward and reverse in one walk. Three of the four things that function does
  are not a transform over features.
- **`stack` calling `placeRect`, to leave one first-fit implementation.**
  `placeRect` keeps every placed interval per row so it can insert into a gap,
  which is what an out-of-order caller needs; `stack` sorts by start first and
  a row is then one number. Converging on `placeRect` would add a per-feature
  splice-capable row array to the step, and converging the other way would
  take the gap insertion away from alignments' row-scan path. The parity test
  is what the two share, and it costs neither anything.
