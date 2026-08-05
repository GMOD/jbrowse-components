---
title: RNA-seq visualization
description: Spliced reads, splice arcs, and strand-specific coverage in RNA-seq
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

**TL;DR:** JBrowse derives splice arcs and per-read spliced alignments from
BAM/CRAM CIGAR `N` skips automatically, with no extra configuration, and can
color reads by fragment strand for strand-specific libraries.

## Prerequisites

- nothing to install to read along: every figure loads hosted data
- for your own reads, an aligned, sorted and indexed BAM or CRAM from a spliced
  aligner, plus a JBrowse instance to load it into (the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which opens a local BAM with
  no hosting step)

## What RNA-seq looks like in the genome browser

The example gene is ACTB, chosen for a clean first look at RNA-seq: deep, even
read coverage over a compact gene.

Each grey box below is a read. The thin teal lines jumping across a gap are
spliced alignments, where a read maps partly to one exon and partly to the next,
skipping the intron between them. The histogram along the top is read coverage
at each position, and the reference gene annotation (an NCBI GFF) sits above it.

<Figure caption="RNA-seq reads over ACTB: the coverage histogram (top), strand-colored splice arcs, the spliced read pileup, and the NCBI RefSeq gene model." src="/img/rnaseq/basic.png" />

## Read coverage and read height

The histogram along the top of the track is JBrowse's running per-position read
count over the reads in the pileup below it. It is raw depth, not an expression
estimate: comparing genes or libraries by it takes the transcript-length and
library-size normalization a counts pipeline does, which the browser does not
apply.

Pick **Read height** → **Compact** in the track menu to pack the full read stack
into view:

<Figure caption="ACTB under compact read height: the whole read stack fits the track, under the per-position coverage histogram and the hg19 NCBI RefSeq gene model." src="/img/rnaseq/compact_stacked.png" />

## Spliced reads, CIGAR strings, and splice arcs

RNA is spliced before sequencing, so a read mapped back to the genome can skip
across the introns that were removed. A spliced aligner like
[STAR](https://github.com/alexdobin/STAR) records this by split-mapping the read
(part aligns to one exon, part to the next) and encoding the skip in the read's
CIGAR string, the SAM/BAM field describing how a read aligns to the reference.

A real spliced read from the ACTB pileup above (reads here are 51 bp) has a
CIGAR like this, spaced out for readability:

```
18M 95N 33M
```

That means 18 bp (`M`, match) aligned to one exon, a 95 bp skip (`N`) across the
intron, and 33 bp (`M`) aligned to the next. Every `N` in a read's CIGAR is one
skipped intron.

On the fly, JBrowse finds every read whose CIGAR contains a skip and draws each
one as an arc. The arc takes its color from the transcript strand the aligner
recorded on the read, in the `XS`, `TS` or `ts` tag: red for forward, blue for
reverse. A read carrying none of those tags is drawn in the no-strand color
instead, so a BAM aligned by STAR without `--outSAMstrandField intronMotif`
gives arcs of one neutral color. The track in the figure above is named
`(BAM,XS)` for that reason.

At Normal read height each spliced read reads on its own: its two exon-aligned
ends are grey boxes joined by a thin teal line across the skipped intron. That
connector is drawn per read, separate from the red/blue arcs above it, which
aggregate every read crossing a junction.

## Strand-specific RNA-seq

The strand colors on the arcs above come from a per-read tag the aligner wrote
from the splice-site motif. A _strand-specific_ library, which this one is,
records the strand a different way, in which mate of the pair the read is, so it
carries the answer for every read rather than only for spliced ones. That
matters wherever genes sit close together or overlap on opposite strands, since
without strand information nothing says which gene a read belongs to.

The surfeit locus is a tightly-packed gene cluster with genes alternating
strands (RPL7A, SURF1, SURF2, SURF4), which makes it a window with its own
control: the coloring is derived from the reads alone, so where it switches has
to agree with an annotation that was no part of computing it. Open the track
menu and pick **Color by... → Paired end → First of pair strand**:

<Figure caption="The same reads under the two colorings at the surfeit locus. Default coloring is one grey pileup across the cluster; first-of-pair strand splits it into two colors that switch where the genes do." src="/img/rnaseq/strand_specific.png" links="Default=rnaseq/strand_specific_default,First of pair strand=rnaseq/strand_specific_pair" />

## Short reads vs long reads

Short-read RNA-seq (usually Illumina, ~150 bp per read) fragments each
transcript, so a transcript is reassembled from many overlapping reads.
Long-read RNA-seq (PacBio IsoSeq, Nanopore) often spans a whole transcript in
one read, so a single read can align across every exon: its CIGAR carries one
`N` skip per intron, and JBrowse derives the same splice arcs and per-read
connectors from those skips:

<Figure caption="Long-read (IsoSeq) RNA-seq in JBrowse 2. A long read often spans all of a transcript's exons at once, producing a long, clean spliced alignment." src="/img/rnaseq/longread_isoseq.png" />

Because a long read carries a whole isoform end-to-end, each read corresponds to
one isoform, with no inference across junctions required.

## Loading your own RNA-seq data

An aligned, sorted and indexed BAM or CRAM loads from **Add track** in JBrowse
Web, or as an `AlignmentsTrack` in a config:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "my_rnaseq",
  "name": "My RNA-seq",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://yourhost/rnaseq.bam"
  }
}
```

The track's `assemblyNames` must match an assembly already configured in
JBrowse; see the
[assemblies configuration guide](/docs/config_guides/assemblies). To produce the
BAM, align reads with a spliced aligner such as STAR, then run `samtools sort`
and `samtools index` so the `.bai` sits beside the BAM.

See the [alignments track config guide](/docs/config_guides/alignments_track)
for adapter and display options. A precomputed coverage signal, such as a
strand-specific BigWig from the aligner, loads separately as a
[quantitative track](/docs/user_guides/quantitative_track).

## See also

- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/quantitative_track)
- [Gene tracks](/docs/user_guides/gene_track)
- [JBrowse Jupyter / anywidget](/docs/jbrowse_jupyter)
- [Gallery: alignments and long reads](/gallery/#alignments)
