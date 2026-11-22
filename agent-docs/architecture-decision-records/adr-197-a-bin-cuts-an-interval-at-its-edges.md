---
status: Accepted
summary: "`bin` keeps placing a row by its start and gains an interval form, `fields: [start, end]`, that cuts each row at bin edges with an `overlap`; an `aggregate` op takes a `weight`, so the MAF identity is a declared, base-exact mean"
---

# ADR-197: A bin cuts an interval at its edges

## Status

Accepted (2026-09-28). Closes the identity item that
[ADR-187](adr-187-a-cells-step-reads-a-row-against-the-block-it-came-from.md)
left outside `cells` and
[ADR-190](adr-190-the-maf-display-stays-off-the-feature-steps.md) measured as
wrong, and the "weighted coverage" gap `GRAMMAR_OF_GRAPHICS.md` notes.

## Context

`bin` places a row in the bin its `field` falls in. A MAF `cells` run of 500
matching bases then counts once, in its start's bin, so `aggregate mean` over
`match` is a mean of runs rather than of bases, and a bin the run crosses sees
none of it. The bench-only lanes in `packages/core/benches/columnSteps.ts`
(`binnedMeanColumns`) showed what the identity needs: each run cut at the bin
edges and the mean weighted by the bases each piece puts in its bin. The same
cut is what a BigWig tier's mean needs, since a tier row straddles bins too.

Vega-Lite's `bin` places a datum by one field too, and neither its `aggregate`
nor GenomeSpy's takes a weight. GenomeSpy's `coverage` does take one, and its
source names binned coverage — a transform that bins the coverage segments
and takes weighted averages — as the step it has yet to write
(`packages/core/src/data/transforms/coverage.js`). An interval `bin` and a
weighted `mean` are that step spelled as two, over any rows rather than only
coverage runs.

The start-bin rule is right for what it counts. The `make-density` sidecar
counts starts (`density-generator.ts`), and the density tier stands in for the
fetched count, so the two have to agree. Colin kept `bin` as it is and asked
for the interval case as an explicit spelling.

## Decision

- **`BinStep` takes `fields: [start, end]`**, the pair spelling `pileup`
  already uses, mutually exclusive with `field` in the type. Each row is cut
  into one piece per bin it overlaps; a piece writes the bin's edges where
  `as` says, as `bin` does, and `overlap`
  (`BIN_OVERLAP_FIELD`), the row's bases inside the bin. A zero-length row, a
  `cells` insertion, is one piece of overlap 0 in the bin holding its
  position; a row whose ends are not numbers or run backwards is none.
- **A piece is its row with fields beside it**, a `WithTable` over the rows
  with a parent row per piece, as a `mate` end is: its id and hover JSON are
  the row's with the written fields over them, and `madeFrom` stays false, so
  its `parent()` is the row's parent. A `cells` run's piece still answers the
  species row, which a piece of a run is not a child of.
- **`AggregateOp.weight`** names a field each row counts by: `count` is the
  weights' sum, `sum` Σ(v·w) and `mean` Σ(v·w)/Σw over the rows whose value
  and weight are numbers. A weight moves no minimum or maximum, so `min` and
  `max` ignore it and the rule list warns (`unread-weight`). An unweighted
  row adds a weight of 1, which leaves every sum it wrote before to the bit;
  `OpSums` is the one accumulator both paths below add to.
- **A fused kernel behind two ordinary steps.** Where an interval `bin` is
  followed directly, in one step list, by an `aggregate` grouped by the bin's
  two edges and reading plain fields, `runSteps` runs `binnedAggregate`: each
  section's bins get a dense index, groups are numbered in the order the
  pieces would meet them, and each op's sums add each row's pieces in row
  order, a row whose value is not a number skipped whole. That is the order
  the unfused aggregate adds in, so the rows, their ids, their order under a
  facet and every double match; `intervalBin.test.ts` holds the two paths
  equal over random intervals, three `as` spellings, weighted and unweighted
  ops and a facet, and fails when the kernel's overlap, its row weights, its
  section numbering or a piece-read value is sabotaged, and when `runSteps`
  stops calling the kernel, which it spies on. Bins spread thinner than two
  per piece over a section run the two steps as written.
- **The kernel is off the plugin ABI.** `binnedAggregate.ts` holds it and the
  fusion predicate, and `stepTables.ts` what it shares with the steps (the
  step readers, `intervalsOf`, `OpSums`, `madeGroups`, the made-row table).
  `featureTransforms.ts` imports both by relative path and exports neither,
  so neither is a package subpath or a runtime re-export; it re-exports only
  `DEFAULT_BIN_AS` and `BIN_OVERLAP_FIELD`, the names a config writes.
  [ADR-112](adr-112-a-layer-owns-its-transform-and-its-zoom-range.md) declined
  a fused `bin` step with aggregates of its own as a third spelling; this is
  no spelling at all, only how two declared steps run.
- **The display writes `fields` and `weight`** (`markTransformConfigSchema.ts`,
  `stepsOf`): a bin names `field` or `fields` on the wire, never both, and
  `model.test.ts` pins that alongside every other slot. The rule list warns on
  a `field` beside `fields` (`bin-field-and-fields`), on a `fields` naming
  other than two, and reads `ops[k].weight` as a field reference; `writes()`
  lists `overlap`, so a facet still splits ahead of an interval bin.
- **The fused kernel keeps only the fetched region's bins.** A row that ends
  off screen is cut along its whole length, so one 2.2 Mb feature binned at
  5 bp and counted made 440,000 groups in 36-49 ms and 10.6 MB on the fused
  path, where about 800 bins lie in the region fetched at 1 bp/px.
  `layerTables` takes the fetched region as `request.clip`
  (`layerFeatures.ts` its region, `collectMarkRowMatrix.ts` each of its
  regions), and `intervalsOf` keeps a row on the clip's `refName`, binned by
  its own `start` and `end`, to the bins from the one holding the clip's start
  to the last starting before its end; the edge bins stay whole and each
  piece's overlap is what it was. Clipped, the same feature makes 800 groups
  in 0.05 ms and 0.02 MB (against 42.8 ms and 10.56 MB unclipped, one ada
  run). No kept bin moves: fusion groups by exactly the bin edges, so a kept
  bin gathers exactly the pieces it gathered unclipped, and an edge bin is as
  partial as it was before (the fetch widens only to the widest bin step,
  `toBinEdges` caps at the displayed region, and the matrix's and the
  multi-way synteny lanes' regions are not widened). Where the kernel hands a
  sparse section back to the steps as written, that `bin` takes the same
  clip, so the answer never rests on the density heuristic.
- **A fused pair clips only where nothing after it reads across rows.** A
  dropped bin still changes an answer a later cross-row step gives inside the
  region: a `window` mean at the region's edge averages its neighbours off
  it, an `aggregate` with no groupby sums every bin, a running total adds the
  bins before the region. So `runSteps` passes the clip to a pair only where
  every later step in its list, the facet's list and each layer's list is a
  `filter`, `formula`, `flatten` or `bin` (`clipThrough`); a `window`,
  `aggregate`, `coverage`, `pileup`, `mate` or `cells` after it leaves it
  unclipped, as does a `cells` straight before it, so the `cells` walk, which
  takes no clip, and the steps it hands back answer alike.
- **Only a fused pair clips.** On the unfused path a piece outside the region
  still changes a correct answer: an aggregate by name sums each row's overlap
  across every bin, and a row wholly off the region would vanish. So an
  unfused interval `bin`, a `bin` in the display's or the facet's steps with
  its `aggregate` in a mark's list, and a fused pair a cross-row step follows
  still cut a row along its whole length, into length over step pieces at any
  zoom: a mark's `maxBpPerPx` bounds only how far out the view goes, not a
  long feature at a close zoom. These stay open in
  [mark-display-audit](../handoffs/mark-display-audit.md), and the warning
  for a fine `step` stays declined for them too; no rule guesses which
  feature is long.
- The `marks_maf_identity` track in the volvox marks config declares the
  identity heatmap: `cells`, then a span over `bin: auto` by `fields` and the
  weighted mean of `match`.

## Measured

The MAF identity over the synthetic MAF-tabix fixture, `bin` at 64 bp: the MAF
display's `buildIdentityRuns`, the bench-only lanes, and the declared steps
over the MAF adapters' table, fused and with the bin moved into the facet's
list so no kernel fuses it:

<!-- BEGIN GENERATED MEASUREMENT interval-bin-maf-identity -->

_Generated by `pnpm autogen` — edit the source, not this block._

| region                                 | bins | MAF display | control |   lanes |   fused | unfused | fused vs MAF | fused vs lanes | fused vs unfused | declared, worst error | start bin, worst error |
| -------------------------------------- | ---: | ----------: | ------: | ------: | ------: | ------: | -----------: | -------------: | ---------------: | --------------------: | ---------------------: |
| 26 species, 1600 blocks of 250 columns | 195k |      84.3ms |  80.7ms | 149.0ms | 193.0ms | 249.6ms |        2.29x |          1.30x |            0.77x |                  0.00 |                  0.984 |
| 26 species, 20000 blocks of 8 columns  |  81k |     103.2ms | 106.3ms | 114.5ms | 175.9ms | 202.1ms |        1.70x |          1.54x |            0.87x |                  0.00 |                  0.386 |
| 470 species, 200 blocks of 250 columns | 440k |     182.6ms | 178.1ms | 345.9ms | 468.9ms | 611.2ms |        2.57x |          1.36x |            0.77x |                  0.00 |                  0.984 |


<!-- END GENERATED MEASUREMENT interval-bin-maf-identity -->

The declared identity is the oracle's, bases matched over bases compared
counted straight off the text, in every bin, where ADR-190's start-bin mean
was off by up to
0.984<!--m:interval-bin-maf-identity.startBinWorst.max-->. Fused, it runs in
0.77-0.87x<!--m:interval-bin-maf-identity.fusedVsUnfused.range--> of the
unfused steps' time and at
1.30-1.54x<!--m:interval-bin-maf-identity.fusedVsLanes.range--> the lanes',
which encode nothing, and at
1.70-2.57x<!--m:interval-bin-maf-identity.fusedVsMaf.range--> the MAF
display's. The first version of the kernel ran level with the unfused steps:
it added each piece through a method call and read each op's value through a
switch on where it came from, which cost it half its walk, and it now runs
one tight loop per op over the rows. What is left
between it and the MAF display is the `cells` walk, which makes every run
before the bin cuts it, where `buildIdentityRuns` counts matches in the one
walk; a `cells` that bins as it walks is the handoff's next lever.

A BigWig tier through the same steps, against the raw section's
coverage-weighted mean over the same bins, is in
[MARK_ENCODING.md](../reference/MARK_ENCODING.md)'s BigWig table, whose
weighted column is now the declared steps rather than a simulation. The
simulation weighted each tier row by its span in its start's bin and read
within a hair of the unweighted mean, so the table said a `validCnt` was the
only lever left; cutting the rows at the bin edges is the one that moves it,
from
1.75%<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.meanErrPct--> to
0.23%<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.weightedErrPct-->
of the score range at volvox's 256 bp tier, for
0.09ms<!--m:mark-vs-wiggle-bigwig.volvox-microarray-bw-256.tableWeightedMs-->
a screen.

## Consequences

- A per-base mean, a covered-bases count (`count` weighted by `overlap`) and a
  count of the features overlapping each bin (`count` alone over the pieces)
  are declarable over any feature adapter, which `coverage` answered only as
  runs of depth.
- A clipped fused pair makes no bin past the fetched region. Elsewhere pieces
  past it still hold only the rows that reach into it, as a start bin
  before the region holds only the rows the fetch returned; the display's
  bin-edge widening fills an edge bin only within the displayed region.
- The kernel fuses only within one step list: a `bin` in the display's or the
  facet's steps and the `aggregate` in a mark's run apart, correctly and with
  the piece table, and unclipped, so such a pair still cuts a long feature
  along its whole length.
