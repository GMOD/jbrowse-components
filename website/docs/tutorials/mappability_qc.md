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

<Figure src="/img/qc/smn_block_and_reads.png" caption="Two scales of the same place. Top, a wide span of chr5 with SMN2 and SMN1 banded: RefSeq genes, gnomAD mean coverage, GIAB's low-mappability and segmental-duplication regions, and the 1000 Genomes long-read SV callset. Bottom, the span the wedge marks, with Umap k100 mappability and NA12878 reads colored by mapping quality." links="Open the wide view=qc/smn_problematic_regions,Open the read view=qc/smn_read_placement" />

The affected sequence is a much larger block than the gene, so a locus can be
inside one of these regions without being inside anything that carries the
gene's name. The two published annotations disagree about where the block ends:
GIAB's interval stops well short of where ENCODE's blacklist continues to.
`scan_mappability_qc.sh` bins the coverage lane so a locus between the two edges
can be settled by measurement, and the lane stays low across the span GIAB has
let go of.

The block is one interval rather than a run of small ones, which is why the
upper panel is as wide as it is. GIAB's annotation over this arm is a single
megabase-and-a-half region, a second one a few kilobases past it, and then
nothing larger than a few kilobases for megabases in either direction. So the
size is the subject: short reads fail across a whole gene neighbourhood here
rather than at scattered sites, and a frame narrow enough to make a read visible
could not show that the failure has edges.

The lower panel is the same block at the scale a read lives at, where reads do
not recover until well past the end of _SMN1_. It is a separate frame for the
same reason: a read is a fraction of a pixel across a span this wide, so a lane
drawn up there could say how much data is present and nothing about where any of
it landed.

## Would a finished assembly fix it?

GRCh38 is not a finished assembly of this chromosome and T2T-CHM13 is. UCSC
publishes an hg38 to CHM13 liftOver chain set, and over this block that chain
set does not resolve to one correspondence:

```bash
tabix https://jbrowse.org/ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz \
  tchr5:69200000-71700000
```

Several of the chains it returns are long, they overlap each other on both
sides, and some of them run backwards.

<Figure src="/img/qc/smn_vs_t2t.png" caption="GRCh38 above, T2T-CHM13 below, each framed on its own SMN2-to-SMN1 span, ribbons from UCSC's liftOver chains and colored by strand. Three chains cross rather than stack." links="Open this view=qc/smn_vs_t2t" />

The gene order is the same in both assemblies (_SMN2_ first, then _SMN1_), so
this is two copies similar enough that a whole-genome chainer can join either
one to either one, which is what the Umap and MAPQ lanes below say per base. The
array is not even the same length in the two assemblies, the genes sitting
closer together in CHM13.

The reads can be asked directly. The 1000 Genomes ONT release, the same project
as the long-read SV callset in the wide figure, aligned some of its samples to
both references with the same minimap2 pipeline, so one sample answers the
question twice. `scan_mappability_qc.sh` counts GM18501's records over _SMN1_ in
each assembly's own coordinates:

| reference | records | MAPQ 0 | MAPQ 60 |
| --------- | ------: | -----: | ------: |
| GRCh38    |     290 |  46.6% |    6.9% |
| T2T-CHM13 |     290 |  46.6% |    9.7% |

The long reads place better than the short-read lane does at the same gene, and
a large share of them still fit somewhere else as well. Between the two
references the columns barely move, so the ambiguity here is a property of the
sequence rather than of the assembly it is aligned to.

## What the lanes are

<Figure src="/img/qc/smn1_evidence.png" caption="The SMN cassette, holding SERF1A, SMN1 and NAIP, with the same four lanes and one read per row. Almost every read is red: mapped where it is drawn, and fitting somewhere else just as well." links="Open this view=qc/smn1_evidence" />

The lanes are independent of each other, which is what makes them worth
stacking:

- **Umap k100 multi-read mappability** is computed from the reference alone. For
  each position it gives the fraction of overlapping 100-mers that are unique in
  the genome. Positions where no 100-mer is unique are absent from the file
  rather than stored as zero, so the lane goes blank rather than to the floor.
  Most of the genome scores near the top of its range, so a blank stretch is
  unusual. How it summarizes decides whether it survives a wide window: the
  default **Score → Summary score mode → Whiskers** draws each pixel's min and
  max, so a bin touching one unique position paints full height, while
  **Minimum** takes the worst position in the bin and sits on the floor across
  the block, stepping up at the same coordinate as the MAPQ 0 to MAPQ 60
  transition and the gnomAD coverage step. Past about a kilobase per pixel even
  **Minimum** saturates low, so this lane belongs in the narrower frame.
- **gnomAD v3 mean genome coverage** is the outcome of that annotation on real
  data, averaged over tens of thousands of sequenced genomes. gnomAD drops
  non-uniquely-placed reads before computing it, so wherever the lane above is
  blank this one falls.
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

## The same depth at both ends

A coverage track alone would show nothing here, which is worth seeing directly.
`scan_mappability_qc.sh` counts the reads in equal windows over _SMN1_ and over
the right-hand end of the frame, from the same library, and they come back at
the same depth: without a MAPQ filter a coverage track draws flat across both.
What separates them is the share of those reads sitting at MAPQ 0, which is most
of them at _SMN1_ and almost none at the control.

The gnomAD lane is what a MAPQ filter does to a depth track, in a different set
of samples. It drops to a fraction of the control's depth over _SMN1_, because
MAPQ 0 reads were dropped before the average was taken.

## What it does to a callset

The long-read lane in the wide figure is empty across the block. Counting over
the flagged block and an equal-width window on either side of it,
`scan_mappability_qc.sh` finds the callset nearly silent inside and populated on
both sides, where the older DGV catalogue carries records throughout.

Widen the same count to the whole chromosome and both catalogues put a larger
share of their calls inside the flagged regions than those regions' share of
chr5 would predict. Segmental duplications are copy-number variable, so this is
where real variation lives as well as where artifacts do.

The lanes support something narrower than a verdict on either callset: at this
locus, in this sample, a short-read call cannot be checked against the reads,
because the reads carry no information about which copy they came from.

## Applying it to your own locus

The same three tracks and a control work anywhere in hg38, so a locus of your
own is a matter of swapping the window:

1. Open the hosted hg38 config and turn on **Umap M100**, **gnomAD v3 Genome
   Coverage - Mean Coverage**, and the **GIAB Problematic Regions** and
   **Problematic Regions** annotation tracks.
2. Add your reads and set **Color by...** → **Mapping quality** from the track
   menu. Turn on **Show legend** in the same menu.
3. Take a second window of the same width, from the same sample, outside every
   flagged interval, and put the two side by side. A red pileup on its own has
   nothing to be red against.

The same comparison is three counts per window, `-q` being a minimum MAPQ:

<!-- from: scripts/scan_mappability_qc.sh -->

```bash
samtools view -c "$CRAM" chr5:70,900,000-71,000,000            # every read
samtools view -c -q 1 "$CRAM" chr5:70,900,000-71,000,000       # placed at all
samtools view -c -q 60 "$CRAM" chr5:70,900,000-71,000,000      # placed uniquely
```

Run it on the control window too: same width, same sample, or the counts mean
nothing against each other.

## Reproduce it end to end

Every number on this page comes from
[`scripts/scan_mappability_qc.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_mappability_qc.sh),
run against the same files the figures draw. It needs kent tools (`bigWigInfo`,
`bigWigToBedGraph`, `bigBedToBed`), `bedtools`, `samtools`, `curl` and `awk`,
downloads the four small annotation files it reads twice, and streams the rest.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/scan_mappability_qc.sh
bash scan_mappability_qc.sh
```

It prints the mappability, coverage, region-annotation, MAPQ and callset
sections in the order this page uses them, so a locus swapped into its `LOCI`
list is measured the same way.

## See also

- [](/docs/tutorials/sv_multisamples)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/user_guides/alignments_track)
- [](/docs/tutorials/genomes_synteny)

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
