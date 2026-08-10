---
title: Low-mappability regions (SMN)
sidebar_label: Low-mappability regions
description:
  Check whether a locus can support the calls made on it, using the mappability,
  coverage and problematic-region tracks genomes.jbrowse.org already publishes
guide_category: Tutorials
tutorial_category: Structural variation
data: hosted
---

**TL;DR:** a pileup looks the same whether its reads belong at a locus or merely
landed there. Four tracks tell the difference, and genomes.jbrowse.org already
publishes all of them for hg38, so this is a click-path rather than a pipeline.
At _SMN1_ every one of them says the placement cannot be trusted; 500 kb away in
the same frame, out of the same sample, every one says the opposite.

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

An aligner reports that as MAPQ 0. The read is still aligned and still drawn
where it aligned; MAPQ is `-10 log10 Pr{mapping position is wrong}`
([SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf)), so 0 is
the aligner saying the position it chose is about as likely wrong as right.
Nothing about the pileup itself announces it.

## The block, and the reads inside it

<Figure src="/img/qc/smn_block_and_reads.png" caption="Two scales of the same place. Top, 2.5 Mb of chr5 with SMN2 and SMN1 banded: RefSeq genes, gnomAD mean coverage, GIAB's low-mappability and segmental-duplication regions, and the 1000 Genomes long-read (ONT) SV callset over 1,019 samples. Coverage runs at full depth into the block, drops across the flagged span, and returns at its right-hand edge, and the callset lane has a hole over the same span. Bottom, 650 kb inside it with SMN1 banded at the left: the same coverage lane, Umap k100 mappability summarized by minimum, and NA12878 reads colored by mapping quality. The mappability lane is on the floor for four fifths of the frame, the pileup over it is red (MAPQ 0) across the same span and multi-colored after it, and the coverage lane steps up at the same coordinate." links="Open the wide view=qc/smn_problematic_regions,Open the read view=qc/smn_read_placement" />

The affected sequence is not the gene, it is a block of about 1.5 Mb that
contains it, so a locus can be inside one of these regions without being inside
anything that carries the gene's name. Neither boundary is sharp: GIAB's
interval ends at chr5:71,009,585 while ENCODE's blacklist continues to
chr5:71,359,500, so a locus sitting between the two edges is one to check by
hand. `scan_mappability_qc.sh` bins the coverage lane at 25 kb, which is how to
settle that by measurement rather than by picking a file. It stays low through
the 350 kb GIAB has let go of and recovers at ENCODE's edge.

The lower panel is the same block at the scale a read lives at. The nearest
sequence where reads recover is 410 kb past the end of _SMN1_, which is why it
is one 650 kb window with the edge inside it rather than a pair of panels a
reader has to hold in mind at once.

## Would a finished assembly fix it?

It is the obvious next question, since GRCh38 is not a finished assembly of this
chromosome and T2T-CHM13 is. UCSC publishes an hg38 to CHM13 liftOver chain set,
and over this block that chain set does not resolve to one correspondence:

```bash
tabix https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz \
  tchr5:69200000-71700000
```

Three of the chains it returns are longer than 800 kb, all three overlap each
other on both sides, and two of the three run backwards.

<Figure src="/img/qc/smn_vs_t2t.png" caption="GRCh38 above, T2T-CHM13 below, each framed on its own SMN2-to-SMN1 span, ribbons from UCSC's hg38 to CHM13 liftOver chains and colored by strand. Three chains cross rather than stack: the same GRCh38 sequence is joined to more than one place in a finished assembly." links="Open this view=qc/smn_vs_t2t" />

That is not the block being inverted — the gene order is the same in both
(_SMN2_ first, then _SMN1_). It is two copies similar enough that a whole-genome
chainer can join either one to either one, which is the same fact the Umap and
MAPQ lanes below state per base, arrived at from an independent direction. The
array is not even the same length in the two assemblies: the two genes are 875
kb apart in GRCh38 and 572 kb apart in CHM13, which is what a
copy-number-variable region does between any two haplotypes.

The chains are an argument. The reads are the measurement, and it agrees with
them. The 1000 Genomes ONT release, which is the same project as the long-read
SV callset in the wide figure, aligned some of its samples to both references
with the same minimap2 pipeline, so one sample can be asked the same question
twice. `scan_mappability_qc.sh` counts GM18501's records over _SMN1_ in each
assembly's own coordinates:

| reference | records | MAPQ 0 | MAPQ 60 |
| --------- | ------: | -----: | ------: |
| GRCh38    |     290 |  46.6% |    6.9% |
| T2T-CHM13 |     290 |  46.6% |    9.7% |

Two things fall out of those three numbers. **Long reads help and do not fix
it**: 46.6% at MAPQ 0 against the 83.2% the short-read lane gives at the same
gene, so roughly half the reads still fit somewhere else as well. And **the
finished assembly changes nothing**: the same reads, the same fraction
unplaceable, a couple of points more of them at MAPQ 60.

So the ambiguity is a property of the sequence rather than of the assembly, and
finishing the assembly does not remove it. What removes it is not a better
reference but a read long enough to span from inside one copy to sequence
outside it, and at ~47% MAPQ 0 an R9 ONT library is not yet that read.

## What the lanes are

<Figure src="/img/qc/smn1_evidence.png" caption="100 kb over the SMN cassette, holding SERF1A, SMN1 and NAIP, with the same four lanes and one read per row. Almost every read is red: mapped where it is drawn, and fitting somewhere else just as well." links="Open this view=qc/smn1_evidence" />

The lanes are independent of each other, which is what makes them worth
stacking:

- **Umap k100 multi-read mappability** is computed from the reference alone. For
  each position it gives the fraction of overlapping 100-mers that are unique in
  the genome. Positions where no 100-mer is unique are absent from the file
  rather than stored as zero, so the lane goes blank rather than to the floor.
  Over the genome its mean is 0.98, so a blank stretch is unusual. It is a
  per-base track, and how it summarizes decides whether it survives a wide
  window: with the default **avg** a zoom bin that is mostly absent averages the
  few present positions and the lane draws a wall near 1, while **min** takes
  the worst position in the bin and the lane sits on the floor across the block
  and steps to 1 at its edge. That step lands at the same coordinate as the MAPQ
  0 to MAPQ 60 transition in the reads and the gnomAD coverage step. Past about
  a kilobase a pixel even **min** saturates low, so this lane belongs in the 650
  kb frame and not in the 2.5 Mb one above it.
- **gnomAD v3 mean genome coverage** is the outcome of that annotation on real
  data, averaged over 76,156 sequenced genomes. gnomAD drops non-uniquely-placed
  reads before computing it, so wherever the lane above is blank this one falls.
- **Mapping quality on the reads** is the aligner's own account, one read at a
  time, in the sample on screen. Red is MAPQ 0, meaning the aligner found
  another place the read fits equally well; yellow is MAPQ 60 and above.
- The **GIAB low-mappability + segdup lane** in the wide panel is a published
  opinion of the same sequence, drawn by a project that had to decide where a
  benchmark stops being trustworthy.

Everything on this page except the read track comes out of the hosted hg38
config at [genomes.jbrowse.org](https://genomes.jbrowse.org): find them in the
track selector under **Multi-read mappability**, **gnomAD v3 Genome Coverage**
and **Problematic Regions**. The reads are the public 1000 Genomes NA12878
high-coverage CRAM, added to the session; the figure's link opens both together.

## The depth is not the problem

The two ends of that pileup have the same depth. `scan_mappability_qc.sh` counts
7,147 reads in a 30 kb window over _SMN1_ and 7,662 in one the same width at the
right-hand end of the frame, from the same library, so a coverage track built
without a MAPQ filter draws a flat 30x across both. What differs is that 83.2%
of the _SMN1_ reads are at MAPQ 0 against 0.8% of the control's.

The gnomAD lane is what that filter does to a depth track, in a different set of
samples: it reads 4.5x at _SMN1_ against 30.6x at the control, because MAPQ 0
reads were dropped before the average was taken.

## What it does to a callset

The long-read lane in the wide figure is empty across the block. Counting over
the flagged block and the equal-width flank on either side of it,
`scan_mappability_qc.sh` gives that callset 81, 2 and 40 records, against DGV's
345, 688 and 376 for the same three spans.

That is not evidence the DGV records are wrong. Across the whole of chr5 the
flagged regions cover 8.2% of the chromosome and hold 18.3% of DGV's call
midpoints and 15.9% of the long-read callset's, so both technologies are
enriched there by about the same factor: segmental duplications are copy-number
variable, and this is where real variation lives as well as where artifacts do.
Enrichment across a callset is not a false-positive rate.

What the lanes support is narrower: at this locus, in this sample, a short-read
call cannot be checked against the reads, because the reads carry no information
about which copy they came from.

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

## References

- Li H, Handsaker B, Wysoker A, et al.
  [The Sequence Alignment/Map format and SAMtools](https://doi.org/10.1093/bioinformatics/btp352).
  _Bioinformatics_ 25:2078-2079 (2009), and the current
  [SAM specification](https://samtools.github.io/hts-specs/SAMv1.pdf), which
  defines MAPQ as `-10 log10 Pr{mapping position is wrong}`.
- Li H, Ruan J, Durbin R.
  [Mapping short DNA sequencing reads and calling variants using mapping quality scores](https://doi.org/10.1101/gr.078212.108).
  _Genome Research_ 18:1851-1858 (2008), which introduced that estimator.
- Karimzadeh M, Ernst C, Kundaje A, Hoffman MM.
  [Umap and Bismap: quantifying genome and methylome mappability](https://doi.org/10.1093/nar/gky677).
  _Nucleic Acids Research_ 46:e120 (2018), the source of the k100 mappability
  track.
- Gustafson JA, Gibson SB, Damaraju N, et al.
  [High-coverage nanopore sequencing of samples from the 1000 Genomes Project to build a comprehensive catalog of human genetic variation](https://doi.org/10.1101/gr.279273.124).
  _Genome Research_ 34:2061-2073 (2024), the source of both the long-read SV
  callset in the wide figure and the GRCh38 / T2T-CHM13 read counts above.
