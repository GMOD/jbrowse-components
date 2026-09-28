---
name: maf-clustering-reads-blocks-into-a-sink
description: Clustering a MAF track by identity builds its matrix off getFeatures, a MafFeature with a string per species per block, and then walks each string's bytes against a per-block column-to-bin map. ADR-195's readBlocks hands a sink every sequence as a range of the line the adapter parsed, so buildIdentityMatrix can count matches straight off those ranges and make no MafFeature and no string. The matrix must come out identical, and the win is unmeasured - no bench times the matrix build yet.
---

# Clustering by identity reads blocks into a sink

Colin asked for this 2026-09-28, while deciding the MAF display stays its own
display type ([ADR-199](../../architecture-decision-records/adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md)).

## What it does today

`buildIdentityMatrix`
(`plugins/maf/src/LinearMafClusterIdentityRpc/buildIdentityMatrix.ts`) runs
when a reader clusters the rows. For each displayed region it subscribes to
`adapter.getFeatures`, and for each `MafFeature` it maps the reference's
columns to bins once, then walks every species' `alignments[sampleId].seq`
with `charCodeAt`, counting a match where the base folds to the reference's.
The parse behind `getFeatures` makes a record and a sequence string per
species per block, and the walk reads them back.

## What to do

Give the matrix a `MafBlockSink` (`plugins/maf/src/util/mafBlockSink.ts`) and
read through `adapter.readBlocks`, which MAF-tabix and bigMaf answer straight
off their parse (`tabixBlockReader.ts`, `stanzaBlockReader.ts`) and every
other MAF adapter answers off `getFeatures` by default:

- `startBlock` builds the column-to-bin map and the folded reference from
  `ref[refFrom..refTo)`, and adds each reference position to `covered`, as the
  loop does now.
- `addRow` looks the row up in `matched` by `sampleId` (a row the display is
  not drawing is skipped, so `order` stays in `sources` order) and counts
  matches over `text[from..to)`.
- `addEmpty` does nothing: an `e` line bridges a gap and aligns no base.

The denominator, the column cap, the segments and the reference-as-outgroup
stay exactly as the function's own doc states them.

## What proves it

- `buildIdentityMatrix.test.ts` holds the matrix equal, bin for bin, to
  today's over the volvox MAF and the synthetic MAF-tabix fixture, for
  MAF-tabix, bigMaf and a default-path adapter (`BgzipMafAdapter`).
- A bench arm in `plugins/maf/benches/mafOnMarks.bench.ts` beside its
  `--parse` arms: the matrix over one region through `getFeatures` against
  through the sink, parse included, on all three fixture shapes. ADR-195
  measured the same change at 0.80x on the MAF display's worker over narrow
  blocks, which is the shape to expect a gain on; wide blocks came out level
  there.
