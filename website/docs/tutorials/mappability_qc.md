---
title: Low-mappability regions (SMN)
sidebar_label: Low-mappability regions
description:
  Check whether a locus can support the calls made on it, using the mappability,
  coverage and problematic-region tracks genomes.jbrowse.org already publishes
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** a pileup looks the same whether its reads belong at a locus or merely
landed there. Four tracks tell the difference, and genomes.jbrowse.org already
publishes all of them for hg38, so this is a click-path rather than a pipeline.
At _SMN1_ every one of them says the reads cannot be placed; at a control 30 kb
window 500 kb away, out of the same sample, every one says the opposite.

## Prerequisites

- nothing to install to read along: every track comes from the hosted hg38
  config, and the one read track is a public CRAM added as a session track
- to re-measure the numbers on this page, the tools listed under
  [Reproduce it end to end](#reproduce-it-end-to-end)

## The locus

_SMN1_ and _SMN2_ sit about 900 kb apart on chromosome 5 and are roughly 99.9%
identical across their ~28 kb. Which of the two a read came from is the
clinically interesting question, since it is the copy number of _SMN1_ that
spinal muscular atrophy turns on, and it is also the question a 150 bp read
cannot answer: the same sequence exists twice, so an aligner given a read from
either copy has two equally good places to put it.

An aligner reports that as MAPQ 0. Nothing about the pileup itself announces it.

## Four ways to see it

<Figure src="/img/qc/smn_vs_control.png" caption="Top, 30 kb over SMN1; bottom, the same width 500 kb away over BDP1, from the same sample. Per panel: RefSeq genes, Umap k100 mappability, gnomAD v3 mean coverage, and NA12878 reads colored by mapping quality. Two pileups of the same depth, in opposite colors." links="Open the SMN1 panel=qc/smn1_evidence,Open the control panel=qc/control_evidence" />

The four lanes are independent of each other, which is what makes them worth
stacking:

- **Umap k100 multi-read mappability** is computed from the reference alone. For
  each position it gives the fraction of overlapping 100-mers that are unique in
  the genome. Positions where no 100-mer is unique are absent from the file
  rather than stored as zero, so the lane goes blank rather than to the floor.
  Over the genome its mean is 0.98, so a blank stretch is unusual.
- **gnomAD v3 mean genome coverage** is the outcome of that annotation on real
  data, averaged over 76,156 sequenced genomes. gnomAD drops non-uniquely-placed
  reads before computing it, so wherever the lane above is blank this one falls.
- **Mapping quality on the reads** is the aligner's own account, one read at a
  time, in the sample on screen. Red is MAPQ 0, meaning the aligner found
  another place the read fits equally well; yellow is MAPQ 60 and above.
- The **problematic-region annotations** in the next figure are three projects'
  published opinions of the same sequence.

Everything on this page except the read track comes out of the hosted hg38
config at [genomes.jbrowse.org](https://genomes.jbrowse.org): find them in the
track selector under **Multi-read mappability**, **gnomAD v3 Genome Coverage**
and **Problematic Regions**. The reads are the public 1000 Genomes NA12878
high-coverage CRAM, added to the session; the figure's link opens both together.

## The depth is not the problem

The two pileups have the same depth. `scan_mappability_qc.sh` counts 7,147 reads
in the _SMN1_ window and 7,662 in the control, from the same library, so a
coverage track built without a MAPQ filter draws a flat 30x across both. What
differs is that 83.2% of the _SMN1_ reads are at MAPQ 0 against 0.8% of the
control's.

The gnomAD lane is what that filter does to a depth track, in a different set of
samples: it reads 4.5x at _SMN1_ against 30.6x at the control, because MAPQ 0
reads were dropped before the average was taken.

## How far the region runs

<Figure src="/img/qc/smn_problematic_regions.png" caption="2.5 Mb of chr5 with SMN2 and SMN1 banded. From the top: RefSeq genes, gnomAD mean coverage, GIAB's low-mappability regions, and the ENCODE Blacklist V2. The coverage is depressed across the whole span the two annotation lanes cover; they disagree about where it stops, and the arrow marks which one the coverage agrees with." />

The affected sequence is not the gene, it is a block of about 1.5 Mb that
contains it, so a locus can be inside one of these regions without being inside
anything that carries the gene's name. Neither boundary is sharp, and the two
projects drew them differently: GIAB's interval ends at chr5:71,009,585 and
ENCODE's continues to chr5:71,359,500. They were built for different purposes
from different evidence, so a locus sitting between the two edges is one to
check by hand.

Here the coverage lane settles which one to believe, and it does so on the
image: it stays down through the whole 350 kb GIAB has already let go of and
comes back at ENCODE's edge. That is one locus and not a verdict on either
project, but it is the reason to treat the gap between two edges as unresolved
rather than as the narrower interval being the current one.
`scan_mappability_qc.sh` prints the same lane in 25 kb bins if you want the
step as numbers.

The control window in the first figure begins at 71,455,000, which is 40 kb past
where that recovery is complete.

## What it does to a callset

<Figure src="/img/qc/callsets_at_smn.png" caption="The same 2.5 Mb: RefSeq genes, the DGV structural-variant catalogue, the 1000 Genomes long-read (ONT) SV callset over 1,019 samples, and GIAB's low-mappability and segdup regions. Each callset is collapsed to one row so the two are directly comparable: DGV runs wall to wall, and the long-read callset has a hole in exactly the flagged span." />

Two callsets asking the same question of the same sequence disagree completely
about whether there is anything to report. Counting over the flagged block and
the equal-width flank on either side of it, `scan_mappability_qc.sh` gives DGV
345, 688 and 376 records, and the long-read callset 81, 2 and 40.

That is not evidence the DGV records are wrong, and the same script says why
not. Across the whole of chr5 the flagged regions cover 8.2% of the chromosome
and hold 18.3% of DGV's call midpoints; they also hold 15.9% of the long-read
callset's. Both technologies are enriched there by about the same factor,
because segmental duplications are copy-number variable: this is where real
variation lives as well as where artifacts do. Enrichment across a callset is
not a false-positive rate.

What the lanes do support is narrower: at this locus, in this sample, a
short-read call cannot be checked against the reads, because the reads carry no
information about which copy they came from. That is a statement about the
evidence, not about the variant.

:::note

Measure the calls, not the intervals. Asking whether a record _overlaps_ a
flagged region rather than where its midpoint falls scores the callset with
larger records higher for having larger records: it moves DGV from 18.3% to
43.5% on chr5 and invents a difference between the two callsets that is not
there.

:::

## Applying it to your own locus

The recipe is three tracks and a control:

1. Open the hosted hg38 config and turn on **Umap M100**, **gnomAD v3 Genome
   Coverage - Mean Coverage**, and the **GIAB Problematic Regions** and
   **Problematic Regions** annotation tracks.
2. Add your reads and set **Color by** → **Mapping quality** from the track
   menu. Turn on **Show legend** in the same menu.
3. Take a second window of the same width, from the same sample, outside every
   flagged interval. Without it, a red pileup is a claim you cannot check; with
   it, the comparison is the finding.

## Reproduce it end to end

Every number on this page comes from
[`scripts/scan_mappability_qc.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_mappability_qc.sh),
run against the same files the figures draw. It needs kent tools (`bigWigInfo`,
`bigWigToBedGraph`, `bigBedToBed`), `bedtools`, `samtools`, `curl` and `awk`,
downloads the four small annotation files it reads twice, and streams the rest.

```bash
bash scripts/scan_mappability_qc.sh
```

It prints the mappability, coverage, region-annotation, MAPQ and callset
sections in the order this page uses them, so a locus swapped into its `LOCI`
list is measured the same way.

## See also

- [](/docs/tutorials/sv_multisamples), a callset read on its own terms, without
  this layer under it
- [](/docs/tutorials/pangenome_hprc), the other answer to a locus short reads
  cannot place: stop using one reference
- [](/docs/user_guides/alignments_track), the rest of the coloring and filtering
  options the read lane here uses two of
- [](/docs/tutorials/genomes_synteny), another walkthrough built entirely on the
  hosted UCSC configs
