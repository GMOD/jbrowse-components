---
title: RNA-seq visualization
description:
  Understand what RNA-seq looks like in the genome browser, from spliced reads
  and splice arcs to alternative splicing and strand-specific coverage
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

This tutorial shows how RNA-seq data appears in JBrowse 2: what the reads look
like, how spliced alignments and splice arcs come from CIGAR strings, how the
arcs reveal alternative splicing, and how strand-specific and long-read RNA-seq
differ. Every screenshot has a live link so you can open the same view yourself,
using JBrowse's [session-spec URL format](/docs/urlparams#session-spec).

Analyzing expression in a notebook? The
[Jupyter differential-expression example](/docs/jbrowse_jupyter) takes a DE
table straight to a gene track colored by call, and opens in Colab with one
click.

## What RNA-seq looks like in the genome browser

The example gene here is **ACTB** (β-actin), a highly-expressed housekeeping
gene, which makes it a clean first look at RNA-seq: deep, even read coverage
over a compact gene.

Each grey box below is a **read**. The thin teal lines jumping across a gap are
**spliced alignments**, where a read maps partly to one exon and partly to the
next, skipping the intron between them. The histogram along the top is read
coverage at each position, and the reference gene annotation (an NCBI GFF) sits
above it.

<Figure caption="RNA-seq reads over ACTB: the coverage histogram (top), strand-colored splice arcs, the spliced read pileup, and the NCBI RefSeq gene model." src="/img/rnaseq/basic.png" />

## Read depth reflects expression level

The more reads that stack up over a region, the more highly expressed it is. The
coverage histogram along the top of the track is JBrowse's running per-position
read count, so tall coverage flags a highly-transcribed gene.

Turn on the **compact** display (in the track menu) to pack the full read stack
into view:

<Figure caption="The compact display packing the full read stack over a gene. Coverage depth broadly tracks expression level." src="/img/rnaseq/compact_stacked.png" />

## Spliced reads, CIGAR strings, and splice arcs

RNA is spliced before sequencing, so a read mapped back to the genome can skip
across the introns that were removed. A spliced aligner like
[STAR](https://github.com/alexdobin/STAR) records this by split-mapping the read
(part aligns to one exon, part to the next) and encodes the skip in the read's
CIGAR string (Compact Idiosyncratic Gapped Alignment Report, the field in a
SAM/BAM record that summarizes how a read aligns to the reference).

A real spliced read from the ACTB pileup above (reads here are 51 bp) has a
CIGAR like:

```
18M 95N 33M
```

(CIGAR strings normally have no spaces; they're added here for readability.)
That means 18 bp (`M`, match) aligned to one exon, a 95 bp skip (`N`) across the
intron, and 33 bp (`M`) aligned to the next. ACTB's introns run from roughly 95
bp to 860 bp, and every `N` in a read's CIGAR is one skipped intron.

JBrowse counts, on the fly, every read whose CIGAR contains a skip and draws
each as an arc. It also reads the splice signal (the GT/AG dinucleotides
flanking the intron) to determine strand: red arcs are forward-strand splice
events, blue arcs are reverse-strand. Zoom in on the pileup (compact display
off) and each individual spliced read shows its two exon-aligned ends as grey
boxes joined by a thin **teal** line across the skipped intron, a per-read
connector distinct from the red/blue strand-colored arcs. Mouse over any read to
inspect it.

## Strand-specific RNA-seq

The strand colors on the arcs above are inferred from the splice-site motif, but
a _strand-specific_ library (like this one) additionally records which strand
each read's transcript came from. That matters wherever genes sit close together
or overlap on opposite strands: without strand information you can't tell which
gene a read belongs to.

The **surfeit locus** is a tightly-packed gene cluster with genes alternating
strands (RPL7A, SURF1, SURF2, SURF4). Coloring each read by its fragment's
strand cleanly separates them:

<Figure caption="The surfeit locus with reads colored by fragment strand. RPL7A reads take one color and the neighboring opposite-strand SURF genes take the other, so every read is assigned to the correct gene even where their transcripts abut." src="/img/rnaseq/strand_specific.png" />

## Short reads vs long reads

Short-read RNA-seq (usually Illumina, ~150 bp per read) fragments each
transcript and is reassembled from many overlapping reads. Long-read RNA-seq
(PacBio IsoSeq, Nanopore) often spans a whole transcript in one read, so a
single read can align across every exon: its CIGAR carries one `N` skip per
intron, and JBrowse derives the same splice arcs and per-read connectors from
those skips:

<Figure caption="Long-read (IsoSeq) RNA-seq in JBrowse 2. A long read often spans all of a transcript's exons at once, producing a long, clean spliced alignment." src="/img/rnaseq/longread_isoseq.png" />

Because a long read carries a whole isoform end-to-end, long-read RNA-seq makes
alternative splicing even more direct: each read _is_ one isoform, no inference
across junctions required.

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

The track's `assemblyNames` must match an assembly already configured in
JBrowse; if you don't have `hg38` set up yet, add it first (see the
[assemblies configuration guide](/docs/config_guides/assemblies)). (Reads come
from a spliced aligner such as STAR, then `samtools sort` + `samtools index` so
the `.bai` sits beside the BAM.)

JBrowse computes the splice arcs and per-read splicing shown above from the
CIGAR strings automatically, with no extra configuration; to color reads by
fragment strand, open the track menu's color-scheme options and choose **First
of pair strand**. See the
[alignments track config guide](/docs/config_guides/alignments_track) for
adapter and display options. For a precomputed coverage signal (e.g. a
strand-specific BigWig produced by your aligner), load it separately as a
[quantitative track](/docs/user_guides/quantitative_track).

## See also

- [Alignments track](/docs/user_guides/alignments_track) - splice arcs,
  soft-clipping, coloring, and the other display options for BAM/CRAM
- [Quantitative track](/docs/user_guides/quantitative_track) - loading a
  precomputed coverage signal such as a strand-specific BigWig
- [Gene tracks](/docs/user_guides/gene_track) - displaying the reference gene
  annotations that RNA-seq reads are compared against
- [Gallery: alignments and long reads](/gallery/#alignments) - the RNA-seq
  splice-junction example alongside other long-read alignment views
