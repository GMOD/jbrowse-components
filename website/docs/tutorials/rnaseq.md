---
title: RNA-seq analysis
description:
  Understand what RNA-seq looks like in the genome browser, from spliced reads
  to splice arcs
guide_category: Tutorials
---

This tutorial shows how RNA-seq data appears in JBrowse 2: what the reads look
like, how spliced alignments and splice arcs come from CIGAR strings, and how
short-read and long-read RNA-seq differ. Every screenshot has a live link so you
can open the same view yourself, using JBrowse's
[session-spec URL format](/docs/urlparams#session-spec).

## What RNA-seq looks like in the genome browser

An RNA-seq BAM file over the ACTB gene. Each grey box is a **read**; the thin
teal lines jumping across a gap are **spliced alignments**, where a read maps
partly to one exon and partly to the next, skipping the intron between them. The
histogram along the top is read coverage at each position, and the reference
gene annotation (an NCBI GFF) sits above it.

<Figure caption="RNA-seq reads over ACTB: the coverage histogram (top), strand-colored splice arcs, the spliced read pileup, and the NCBI RefSeq gene model." src="/img/rnaseq/basic.png" />

## Zooming in on the reads

Zoom in to resolve the individual reads. Each grey box is one read, and each
read corresponds to a fragment of RNA.

<Figure caption="Zoomed to 1 kb, individual reads resolve. Grey boxes are reads; thin teal lines are the per-read splice connectors across skipped introns." src="/img/rnaseq/reads_zoomed.png" />

## Read depth reflects expression level

The more reads that stack up over a region, the more highly expressed it is. The
coverage histogram along the top of the track is JBrowse's running per-position
read count, so tall coverage marks highly-transcribed genes at a glance.

Turn on the **compact** display to pack the full read stack into view:

<Figure caption="The compact display packing the full read stack over a gene. Coverage depth broadly tracks expression, though an accurate expression estimate requires normalization (for gene length, library size, and mapping biases) via tools like HTSeq." src="/img/rnaseq/compact_stacked.png" />

## Spliced reads and CIGAR strings

RNA is spliced before sequencing, so a read mapped back to the genome can skip
across the introns that were removed. A spliced aligner like
[STAR](https://github.com/alexdobin/STAR) records this by split-mapping the read
— part aligns to one exon, part to the next — and encodes the skip in the read's
CIGAR string.

For a read spanning exon 1 and exon 2, the CIGAR might say:

```
10M 500N 10M
```

(CIGAR strings normally have no spaces; they are added here for readability.)

That means 10 bp (`M`, match) aligned to exon 1, a 500 bp skip (`N`) over the
intron, and another 10 bp (`M`) aligned to exon 2.

## Splice arcs

JBrowse counts, on the fly, every read whose CIGAR contains a skip (the `500N`
above) and draws each as an arc. It also reads the splice signal (the GT/AG
dinucleotides flanking the intron) to determine strand: red arcs are
forward-strand splice events, blue arcs are reverse-strand.

## Looking at a specific read

With compact display off, each spliced read draws its two exon-aligned ends as
grey boxes joined by a thin **teal** line across the skipped intron — the same
per-read connector seen zoomed in above, and distinct from the red/blue splice
arcs, which are colored by strand. Mouse over any read to inspect it.

<Figure caption="A tighter window on a few spliced reads. Each read's exon-aligned ends (grey) are joined by a thin teal line spanning the intron it skips." src="/img/rnaseq/single_read.png" />

## Short reads vs long reads

Short-read RNA-seq (usually Illumina, ~150 bp per read) fragments each
transcript and is reassembled from many overlapping reads. Long-read RNA-seq
(PacBio IsoSeq, Nanopore) often spans a whole transcript in one read, so a
single read can align across every exon:

<Figure caption="Long-read (IsoSeq) RNA-seq in JBrowse 2. A long read often spans all of a transcript's exons at once, producing a long, clean spliced alignment." src="/img/rnaseq/longread_isoseq.png" />

A read across five 10 bp exons separated by 500 bp introns produces a CIGAR
like:

```
10M 500N 10M 500N 10M 500N 10M 500N 10M
```

Both render identically in JBrowse — the splice arcs and per-read connectors
come straight from these CIGAR skips.

## Loading your own RNA-seq data

Once you have an aligned, sorted, and indexed BAM or CRAM, you can load it in
JBrowse Web from **Add track**, or add it to a config as an `AlignmentsTrack`:

```json
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

The splice arcs and per-read splicing shown above come for free from the CIGAR
strings — no extra configuration is needed. See the
[alignments track config guide](/docs/config_guides/alignments_track) for
adapter and display options. For a precomputed coverage signal (e.g. a
strand-specific BigWig produced by your aligner), load it separately as a
[quantitative track](/docs/user_guides/quantitative_track).

## See also

- [Alignments track](/docs/user_guides/alignments_track) — splice arcs,
  soft-clipping, coloring, and the other display options for BAM/CRAM
- [Quantitative track](/docs/user_guides/quantitative_track) — loading a
  precomputed coverage signal such as a strand-specific BigWig
- [Gene tracks](/docs/user_guides/gene_track) — displaying the reference gene
  annotations that RNA-seq reads are compared against
