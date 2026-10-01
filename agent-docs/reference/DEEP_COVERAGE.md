---
name: deep-coverage
description: Measured on HG002 300x: the insert-size ±3 MAD cut flags ~1% of any sample, and a support floor must count over a window or it deletes real translocations. Read before adding a threshold to the alignments plugin.
kind: measurement
---

# Deep-coverage short reads: what the defaults get wrong, and why

Measured on **HG002 300x** (GIAB
`NHGRI_Illumina300X_AJtrio_novoalign_bams/HG002.hs37d5.300x.bam`), over a 20 kb
window at GRCh37 1:1,000,000 and a 200 kb window at 1:2,000,000. Neither holds a
structural variant, so both show what the display does when there is nothing to
find. `samtools view <url> 1:2000000-2200000` against the GIAB HTTP URL
reproduces the offline numbers with no download.

## The rule these share

**A cut calibrated as a FRACTION of the sample flags a fixed fraction of it,
however deep the pileup gets.** Every default below looked fine at 30x and washed
out at 300x. When adding a threshold to this plugin, ask what it does when the
sample is 10x larger.

## Insert-size colouring: the band needed a floor

`getInsertSizeStats` is median ± 3·1.4826·MAD. On the 200 kb window that paints
~1% of records long-insert, 81% of them in the library's own right tail, with no
deletion present. `widenBandToEventScale` (`shared/insertSizeStats.ts`) floors the
band to 2x / 0.5x the typical fragment: the colour means an event comparable in
size to the fragment, which is scale-free across library types. The floor is a
`max`, so a shallow pileup keeps the tighter raw band.

## Interchromosomal ticks: scattered, and that is the criterion

Clustering the window's interchromosomal connections on both sides barely changes
anything: 99% are singletons at any window up to 2 kb. They are scattered
mismapping.

**The window is still required.** A real translocation at 300x recruits ~100
pairs, and mates straddle the breakpoint, scattering across a fragment length.
Under `arcKey`'s exact count every one is a singleton, so a naive `support >= 2`
floor deletes the real event with the noise. `clusteredInterchromSupport` counts
over one fragment length on both sides, with the window taken from `stats.upper`
so it tracks the library.

## Same-chromosome discordant arcs: windowed support does NOT work

Declined — don't re-propose. Windowed support on same-chr discordant pairs yields
clusters of 10–24 "supporting" reads, but their TLENs form a smooth continuum
starting at the band cut: a distribution tail being sliced, not a mode. A real
deletion would cluster tightly at its own size. Support there is a density filter
that grows more aggressive where coverage is deepest; the insert-size floor
already controls that family.

## The coverage band's SNP colours

At 300x a 1% sequencing error rate is three reads at every position, so an
un-floored band carries a permanent sliver of every base. The pileup always faded
these through `featureFrequencyThreshold`; the band did not.
`coverageSnpMinFrequency` (Coverage → "Color SNPs above...") is the band's floor,
0 by default because a floor at 30x would hide real low-frequency variants in a
somatic or pooled sample. It is a draw-time test in both backends against each
segment's `segHeight`, so changing it repaints rather than refetches.

Three rules answer "is this event real", calibrated differently:
`featureFrequencyThreshold` (depth-ramped, stricter at low depth; zeroes the
pileup's frequency bytes in the worker), `coverageSnpMinFrequency` (flat, user-set,
at draw time), and `MINIMUM_INDICATOR_READ_DEPTH` + `INDICATOR_THRESHOLD` (an
absolute depth floor, then a flat fraction, for the interbase indicator
triangle). **Below the depth floor no indicator triangle is emitted**, whatever
the evidence. And the pileup ramp can zero a heterozygote at low depth while the
band, floored at 0, still colours it — which is the argument for keeping the
band's floor at 0.

**On a log axis the coloured fraction is the allele proportion, not a count off
the y-axis.** The segments are linear slices of a log-scaled bar
(`coverageSnp.slang`), so a 50% allele is half the bar whatever the scale. Baking
the axis in would need a repack on every autoscale change.

## Arc paint order and concordant pairs

Baseline (normal-insert) arcs outnumber every categorized arc by over 100:1 and
arc strokes are opaque, so paint order is an interest ranking (`arcPaintRank`,
ticks under arcs in `ARC_PASSES`). `drawProperPairArcs` ("Show concordant-pair
arcs") off hides an arc only when the pair is proper (`isConcordantPairRead`,
shared with the "Show proper pairs" read filter) **and** the arc paints the
baseline slot. The flag alone would also hide proper-flagged pairs whose |TLEN|
falls below the band and paint short-insert, which would read as a bug.

To reproduce in the app: a `ChromSizesAdapter` assembly with plain `1`/`2`/…
contigs (the BAM is hs37d5), and a raised `fetchSizeLimit` or Force Load.
