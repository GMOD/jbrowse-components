---
title: RNA-seq visualization
description: Spliced reads, splice arcs, and strand-specific coverage in RNA-seq
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
data: hosted
---

**TL;DR:** JBrowse derives splice arcs and spliced read alignments from BAM/CRAM
CIGAR `N` skips with no configuration, and can color or group reads by
first-of-pair strand for strand-specific libraries.

## Prerequisites

- nothing to install to read along: every figure loads hosted data
- for your own reads, an aligned, sorted and indexed BAM or CRAM from a spliced
  aligner
- a JBrowse instance to load it into: the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which opens a local BAM with
  no hosting step

## Where the data comes from

Three hg19 alignment sets, hosted on jbrowse.org's demo bucket.

- the paired-end stranded RNA-seq alignments behind every short-read figure on
  this page, from the sample files listed at
  [RSeQC](https://rseqc.sourceforge.net/):
  https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam
- the long-read IsoSeq alignments:
  https://s3.amazonaws.com/jbrowse.org/genomes/hg19/alzheimers_isoseq/hq_isoforms.fasta.bam
- the NCBI RefSeq gene models drawn under every figure:
  https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz

## What RNA-seq looks like in the genome browser

The example gene is _ACTB_, a compact gene with deep, even read coverage.

Each grey box below is a read. The thin teal lines jumping across a gap are
spliced alignments, where a read maps partly to one exon and partly to the next,
skipping the intron between them. The histogram along the top is read coverage
at each position.

<Figure caption="RNA-seq reads over ACTB: the coverage histogram (top), strand-colored splice arcs, the spliced read pileup, and the NCBI RefSeq gene model." src="/img/rnaseq/basic.png" />

## Read coverage and read height

The histogram counts the reads in the pileup below it at each position.
Comparing genes or libraries needs the transcript-length and library-size
normalization a counts pipeline applies.

Pick **Read height → Compact** in the track menu to pack the full read stack
into view:

<Figure caption="ACTB under compact read height: the whole read stack fits the track, under the per-position coverage histogram and the hg19 NCBI RefSeq gene model." src="/img/rnaseq/compact_stacked.png" />

## Spliced reads, CIGAR strings, and splice arcs

RNA is spliced before sequencing, so a read mapped back to the genome skips the
introns that were removed. A spliced aligner like
[STAR](https://github.com/alexdobin/STAR) split-maps such a read and encodes the
skip in its CIGAR string, the SAM/BAM field describing how a read aligns to the
reference.

A spliced read from the _ACTB_ pileup above (reads here are 51 bp) has a CIGAR
like this, spaced out for readability:

```
18M 95N 33M
```

That means 18 bp (`M`, match) aligned to one exon, a 95 bp skip (`N`) across the
intron, and 33 bp (`M`) aligned to the next. Every `N` in a read's CIGAR is one
skipped intron.

JBrowse draws an arc for every read whose CIGAR contains a skip, on the fly. The
arc takes its color from the transcript strand: `XS` and `TS` record it
directly, while minimap2's `ts` records the orientation relative to the read,
which JBrowse combines with the read's own strand. Red for forward, blue for
reverse. A read carrying none of those tags gets the no-strand color, so a BAM
aligned by STAR without `--outSAMstrandField intronMotif` gives arcs of one
neutral color.

At Normal read height each spliced read stands on its own: two grey exon-aligned
ends joined by a thin teal line across the skipped intron. That connector is
drawn per read, separate from the red/blue arcs above it, which aggregate every
read crossing a junction.

## Strand-specific RNA-seq

The arc colors above cover only spliced reads. A _strand-specific_ library
records the transcript strand in which mate of the pair a read is, so every read
carries it. That is what tells apart genes sitting close together or overlapping
on opposite strands.

The surfeit locus packs genes tightly and alternates their strands (_RPL7A_,
_SURF1_, _SURF2_, _SURF4_), so the coloring, which comes from the reads alone,
has an annotation to agree with. Open the track menu and pick **Color by... →
Paired end → First of pair strand**:

<Figure caption="The surfeit locus colored by first-of-pair strand. The pileup splits into two colors, and the switch falls where the genes change strand: RPL7A forward, SURF1 reverse, SURF2 forward." src="/img/rnaseq/strand_specific.png" />

Coloring answers the question one read at a time, and the coverage histogram
answers it for a whole gene. Pick **Group by... → First-of-pair strand**, then
turn off **Show... → Show pileup**. Each group gets its own band computed from
only its reads, leaving two histograms, forward and reverse, on one autoscaled
axis.

In the gene-dense MHC class III region, _NELFE_ and _SKIV2L_ sit back to back on
opposite strands:

<Figure caption="NELFE and SKIV2L, adjacent and on opposite strands, grouped by first-of-pair strand: each band carries signal over exactly one of the two genes." src="/img/rnaseq/strand_split_coverage.png" />

Swapping to **Strand** groups on the read's own strand, which for a paired-end
library sends the two mates of every pair to opposite bands, so neither band is
the transcript strand.

## Short reads and long reads

Short-read RNA-seq (usually Illumina, ~150 bp per read) fragments each
transcript, so a transcript is reassembled from many overlapping reads. A long
read (PacBio IsoSeq, Nanopore) often spans a whole transcript, aligning across
every exon with one `N` skip per intron. JBrowse derives the same arcs and
connectors from those skips:

<Figure caption="Long-read (IsoSeq) RNA-seq in JBrowse 2. A long read often spans all of a transcript's exons at once, producing a long, clean spliced alignment." src="/img/rnaseq/longread_isoseq.png" />

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
[assemblies configuration guide](/docs/config_guides/assemblies). Align reads
with a spliced aligner such as STAR, then `samtools sort` and `samtools index`
so the `.bai` sits beside the BAM.

The [alignments track config guide](/docs/config_guides/alignments_track) covers
adapter and display options. A precomputed coverage signal, such as a
strand-specific BigWig from the aligner, loads separately as a
[quantitative track](/docs/user_guides/quantitative_track).

## See also

- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/tutorials/methylation)
- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/gene_track)
- [](/docs/jbrowse_anywidget)
- [Gallery: alignments and long reads](/gallery/#alignments)
