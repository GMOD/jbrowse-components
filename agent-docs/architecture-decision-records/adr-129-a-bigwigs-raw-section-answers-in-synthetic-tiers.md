---
status: Accepted
summary: "`BigWigAdapter` serves up to two synthetic zoom tiers between a file's raw section and its first zoom level: power-of-two bins 4x apart, the coarsest the smallest at or above a quarter of the first level, so each declared range holds at most two bins a pixel and tiles with the file's own under `tierSpanRange`. The file keeps a bin only when it is at least twice the raw section's mean record span, sampled once from four windows spread through its records, so whether a zoom bins is the file's call and never the region's. A synthetic fetch reads the raw section over bin-aligned extents and bins each region: span-weighted mean over covered bases, min and max, each row spanning only the bases its bin covers, identical neighbours merged, rows wholly outside the region dropped. No zoom levels, no synthetic tiers. The FST scan at 319 bp/px goes from 13,966 rows a source to 1,783, and fill at 1000 sources from 266 MiB to 34"
---

# ADR-129: A BigWig's raw section answers in synthetic tiers

## Status

Accepted (2026-09-17). Candidate 1 of
[wiggle-instance-records-carry-per-row-constants](../ideas/wiggle-instance-records-carry-per-row-constants.md).
Narrows the raw-section range
[ADR-125](adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md)
declares, through the mechanism that ADR set up.

Revised the same day after an adversarial review: the sample, the rows outside
a region, which zooms pay for the sample, and what writers do.

## Context

bbi picks the highest level whose reduction fits twice into a span, so a
summary tier holds 0.5-2 rows a pixel. Below half the first level it reads the
raw section, which has no such cap. The idea doc measured 9.31 rows a pixel on
an FST scan at 319 bp/px, 4.67 on phyloP at 4.9 and 2.99 on scRNA coverage at
151. At 1000 sources the FST scan needs 266 MiB of fill records and 426 MiB of
step-line records, past the 256 MiB `maxBufferSize` floor, so that zoom cannot
draw at all.

## Decision

**The ladder.** `syntheticCandidateLevels` takes the file's levels and returns
up to two bins, finest first: `b0`, the smallest power of two at or above a
quarter of the first level, then `b0 / 4`, nothing under 2 bp.
`syntheticReductionLevels` keeps the candidates at or above twice the raw
section's mean record span. The adapter puts them in front of the file's
levels, and `tierLevels` hands that combined list to both `tierSpanRange`
calls: the range `getZoomRange` declares and the tier the fetch reads. Under
bbi's rule a bin `b` serves `[b/2, next/2)`, and `next ≤ 4b` means at most two
bins a pixel, as a file tier gives. Bins sit on absolute multiples of `b`, so a
bin is the same bin in every region and every fetch.

| file | first level | sampled span (whole file) | synthetic | raw section now |
| --- | --- | --- | --- | --- |
| FST scan | 640 | 1 (1) | 64, 256 | under 32 bp/px |
| scRNA CD4_T | 304 | 16.4 (19.3) | 128 (32 dropped) | under 64 |
| phyloP BRCA1 | 10 | 1.21 (1.11) | 4 | under 2 |
| volvox_microarray | 3,478 | 100 (100) | 256, 1024 | under 128 |
| posneg_rw1 | 1,584 | 99.9 (99.8) | 512 (128 dropped) | under 256 |
| volvox coverage | 40 | 1 (1) | 4, 16 | under 2 |
| volvox gff3 density | 15,728 | NaN, 57 records (984) | none | under 7,864 |

The repo's other BigWigs, the posneg, cram and microarray variants and
volvox_sine, read their sibling's ladder above.

**Why two.** Writers size the first level by bytes, not by records. UCSC's
`bedGraphToBigWig` tries `max(mean span, 10)` times powers of 4 and keeps the
first whose summary, estimated at 16 bytes a bin, fits in half the compressed
data (`bbiWriteZoomLevels`). `wigToBigWig` starts at 10x the finest record span
and grows the reduction until its summary fits (`bwgComputeDynamicSummaries`).
So the first level keeps no fixed ratio to the data: 640x the FST scan's span
and 15x its record spacing over the 40 Mb it covers, 9x phyloP's span, 16x
CD4_T's span but 2x its genome-wide spacing, 40x volvox coverage's.

What the files do share is measured under the second synthetic tier's floor, at
most a sixteenth of the first level, where the raw section holds about a row a
pixel. Over 1500 px screens opened at even steps through each file's records:
0.70 rows a pixel on the FST scan at 30 bp/px, 1.78 on phyloP at 1.9, 1.86 on
volvox coverage at 1.9, and 1.25 on CD4_T at 60, where its raw section ends. A
third tier's bins would not halve the rows: 16 bp bins keep 80% of the FST
scan's, and 8 bp bins give CD4_T's first three chromosomes 1.39x their records.

**Why twice the mean record span.** Binning halves the rows only where a bin
holds two records on average. A bin finer than that blends neighbouring
records for few or no fewer rows, and the rows it does ship are wider, since
binned rows carry min and max (20 bytes a row against raw's 12). Over whole
chromosomes the test agrees with the row counts: CD4_T's 32 bp bins keep 57% of
its rows and posneg's 128 bp bins 78%, and both drop, while the bins the table
keeps cut rows to 6-50%. The test is a property of the file and the bin, so
the value at a base reads the same at one zoom however the view fetches it: a
pan, a refetch, or two neighbouring regions cannot flip it between bins and
raw. A dropped bin leaves the ladder, so its zooms read raw.

**Where the span comes from.** The header has no record count to divide
`totalSummary.basesCovered` by. A BigWig's `dataCount` counts sections, not
records (909 on the FST scan's 930,180), and UCSC writes `itemsPerSlot` 1, so
section count times slot size says nothing either. The span has to come from
records.

`sampleMeanRecordSpan` reads the raw index's root node, whose children each
cover the same number of sections but the last, and opens a window where four of
them start, picked at even fractions through the children. The windows sit at
even steps through the file's records on whichever refs hold them, and each
opens on data. A BAM-header-ordered file with chrM first, or one whose data sits
in a single gene, still samples its bulk. A window runs 64 first-level widths,
or 1024 when that holds under 128 records short of its ref's end, and counts its
first 128 records, clipped to the window, so a dense window weighs no more than
a sparse one. The sample is fixed by the file, so the answer is too.

**A sample under 64 records answers NaN**, and NaN keeps every synthetic bin
off. Under 64 records in up to four windows of 1024 first-level widths is a
screen of a few dozen raw rows at the coarsest zoom a synthetic tier would
serve, unless the refs are shorter than a window. The volvox gff3 density file,
57 records, is the one BigWig in the repo that loses a bin to it.

**Only a zoom a synthetic bin could serve reads the sample**: from half the
finest candidate to half the first level, once per adapter. Outside that band
`tierLevels` hands `tierSpanRange` every candidate instead. A coarser zoom
picks the same file level either way, and a finer one, a fetch with no zoom
included, reads raw. Every byte the filehandle returned, read locally:

| file | reads | sample | one window from the index's start, before |
| --- | --- | --- | --- |
| FST scan | 12 | 71.7 KB | 28.6 KB |
| scRNA CD4_T | 12 | 68.4 KB | 27.2 KB |
| phyloP BRCA1 | 8 | 34.9 KB | 22.3 KB |

A window costs about one index leaf, which bbi reads whole at 8 KB, and one data
section.

**The rows.** `binRawRegion` does one pass per region over bbi's raw rows,
fetched over `binAlignedExtent`, so an edge bin sees every record it covers:

- **Score** is the mean over covered bases, each record weighted by the bases it
  overlaps the bin with. A record crossing a boundary counts in both bins, and
  empty bases don't dilute sparse data. The score is the same `sumData /
  validCnt` a bbi summary holds. On the volvox coverage file it reproduces the
  40 bp level wherever the bins coincide: min and max exactly, the mean to
  float32 precision (`syntheticTiers.test.ts`).
- **Min and max** come from the covering records, so `minScores`/`maxScores`
  carry the raw section's true extremes.
- **Extent** is the bases the bin covers, not the whole bin. bbi's own summary
  rows run the full reduction from their first record. Here a bin holding one
  record reproduces that record exactly, and sparse data isn't widened.
- **Merging:** adjacent rows with identical mean, min and max become one row, so
  a long record stays one row. **A merged row's bounds follow the fetch**: bins
  past the extent aren't known, so the extent's edge cuts a run a wider fetch
  would carry on. The value at every base is the same either way, and the
  tooltip's start and end and the feature id are what move.
- **Rows outside the region drop.** An edge bin still aggregates its whole
  bin-aligned extent, so its value doesn't depend on where the region starts,
  but a row whose bases all fall outside the region leaves. Before, 50 of 200
  random regions on the FST scan carried one, and neither the mark display's
  y-domain nor `nearestMarkHit` clips.
- **NaN** records cover nothing, and a bin with no data emits nothing.

**Records that overlap or run out of order answer raw**, trimmed to the region.
The format forbids both, so this is a safety net and the only region-level
fallback left.

**The fetch asks bbi for the raw section explicitly** (`basesPerSpan` of a
quarter of the first level), not with the view's span, which rounds through
`1 / (1 / span)` in bbi.

**A file with no zoom levels gets none.** The ladder has no first level to
anchor to. UCSC's writers always write at least one level, so such a file comes
from another writer, and its raw section is the only resolution it has.

## Consequences

- Every read path goes through one `readRegions`: `getFeatureArraysMulti`,
  `getFeatureArrays`, and `getFeatures` with its `getRegionQuantitativeStats`.
  A synthetic region's features report `summary: true` with `minScore` and
  `maxScore`, so `featuresToRaw` keeps them for a BigWig under a
  MultiQuantitativeTrack. The mark display reads the same bins the wiggle
  display does (`MarkDisplayBigWig.test.tsx`), and two extents over one locus
  read the same values (`syntheticTiers.test.ts`).
- **Callers that send no `bpPerPx` still read raw records, and never read the
  sample.** That covers Save track data, `jb.getFeatures`, and the mark
  display's plot-field scan. The
  mark display's feature-widget read-back now sends the view's zoom, so it gets
  the tier row the hit was drawn from. Before, a tier row opened nothing unless
  a single raw record covered it.
- **What a user sees between the raw section and the first level changes the
  way a file tier's does.** Tooltips and the hit test report the bin's span and
  min/avg/max. Autoscale in `avg` mode reads means, so its domain can narrow,
  while whiskers still reads the raw extremes. Clustering's score matrix and the
  R script built from it average bins. **In `avg` mode a single-base outlier is
  diluted by its bin.** The MultiBigWig multiline and multirowline jest
  snapshots at 5 bp/px, updated with this ADR, lose most of a one-base coverage
  dip on `v1.cram.bw` (220 to 132, drawn as roughly 220 to 197). Whiskers mode
  keeps it. At the raw section's finest zooms nothing changes.
- **A zoom-in through the raw section refetches at each synthetic tier**, at
  most two more refetches, each over blocks bbi already holds.
- **Under the finest candidate the declared raw range ends at half that
  candidate**, since the sample hasn't run. Where the span test drops it, as
  CD4_T's 32 and posneg's 128, a zoom-out across that edge refetches once and
  gets raw records again.
- **A MultiBigWig asks its sources for zoom ranges ten at a time**, the
  `SUBTRACK_FETCH_CONCURRENCY` its fetch uses, since each source's first range
  in the band reads the sample. A thousand remote files had fired every sample
  at once.
- **The mean span is a sample, not the file.** Four windows of 128 records put
  CD4_T's span at 16.4 against 19.3 over the whole file, 2.5% above the 16 bp
  under which its 32 bp bin would come back. A sample can keep a bin the whole
  file would drop, or drop one it would keep. Either way the rows stay exact;
  what moves is how many rows ship and one refetch edge.
- **Worker cost.** Measured with `benches/syntheticTiers.bench.ts`: one
  source, blocks warm, the executor's read plus `processFeaturesFromArrays`,
  min of 40 rounds at load 2-4. The raw control landed within 7% of the raw arm.

  | scenario | rows raw → tier | raw / tier ms | `binRawRegion` alone |
  | --- | --- | --- | --- |
  | FST 319 bp/px (256) | 13,966 → 1,783 | 0.94 / 1.05 | 0.18 ms |
  | FST 100 bp/px (64) | 4,942 → 1,831 | 0.52 / 0.57 | 0.11 ms |
  | scRNA 151 bp/px (128) | 4,492 → 941 | 0.48 / 0.49 | 0.09 ms |
  | phyloP 4.9 bp/px (4) | 7,011 → 1,836 | 0.75 / 0.72 | 0.13 ms |
  | scRNA 60 bp/px (32 dropped, raw) | 846 → 846 | 0.29 / 0.26 | — |

  The worker pays up to about 12% more a source where bins answer, and nothing
  where the file dropped the bin. Binning costs 10-20 ns a raw row.

  At 1000 sources, on the split line records, `instanceBuffer.bench.ts` takes
  the FST scan from 266.4 to 34.0 MiB of fill, from 426.2 to 54.4 MiB of step
  line, from 479.5 to 61.2 MiB of center line, and from 159.8 to 34.0 MiB of
  wire. Its fill pack goes from 245 to 37 ms, its step pack from 409 to 60 and
  its center pack from 518 to 77 (min of 5, loaded box). Binned rows carry
  min/max, so **whiskers mode now packs a band where raw rows had none**:
  74.8 MiB and 86 ms on the same scan, still under the floor. scRNA at 151
  bp/px goes from 85.7 to 17.9 MiB of fill. Summary tiers keep bbi's own rows:
  phyloP at 79 bp/px holds 2,893 a source and scRNA at 667 holds 763, as the
  idea doc measured.

## Rejected alternatives

- **Per-pixel decimation at the fetch zoom.** A payload serves a 4x band of
  zooms without refetching, so pixel-exact bins go coarse on the first zoom-in.
  Bins have to be tiers, which is the idea doc's argument.
- **Bins spanning the whole bin, as bbi's summaries span the reduction.** Those
  would widen sparse data and make a one-record bin disagree with the record.
  Covered extents cost nothing and make the finest tier reproduce the raw rows.
- **The halving test per region**, falling back to raw where a region's bins
  would not halve its rows. This shipped first. The answer then hung on the
  region's extent: a region over one record answered raw where a wider one over
  the same locus answered bins, so a pan or refetch could flip a locus at one
  zoom, and neighbouring regions could disagree. The per-file test gives the
  same answer in expectation without that.
- **Binning whenever it saves any rows.** On scRNA at 60 bp/px, 32 bp bins take
  846 rows to 640 but ship 12.2 MiB against 9.7, since binned rows carry min and
  max, and they blend 10-40 bp records for a quarter fewer rows.
- **A ladder down to 2 bp.** That adds refetches at zooms where the raw section
  already holds a row a pixel, and on coarse data the span test would drop those
  bins anyway.
- **The span from the header alone**, as `basesCovered` over `dataCount`. The
  division reads 1,023 bp on the FST scan's 1 bp records, because `dataCount`
  counts sections. Estimating records per section from `uncompressBufSize`
  needs the section type, 4, 8 or 12 bytes a record, which only a section
  header holds. It also varies by writer.
- **The span remembered from whichever fetch ran first.** The range
  `getZoomRange` declares would depend on fetch order, and it runs beside the
  fetch, not after it.
- **Binning in `processFeaturesFromArrays`.** The executor does not know the
  tiers, and the range the payload declares would stop describing its rows.
  ADR-125 put the zoom rule in the adapter for exactly this reason.
