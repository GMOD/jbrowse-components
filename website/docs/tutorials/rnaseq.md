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
reverse. A junction whose reads carry none of those tags, as in a BAM aligned by
STAR without `--outSAMstrandField intronMotif`, takes its strand from the splice
motif instead: JBrowse reads the first and last two bases of the intron off the
reference, and GT-AG on the forward strand reads as CT-AC on the reverse. The
neutral color is left for a junction whose reads disagree or whose motif is none
of GT-AG, GC-AG and AT-AC. Hovering an arc shows the motif beside the read
count.

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

## Reading a deep pileup

Deep RNA-seq buries the evidence under the reads that carry none. Three controls
in the track menu pull it back out, and each is a setting on the track rather
than a new file.

**Sort by... → Spliced reads first** gives every read whose CIGAR carries a skip
the lowest rows, so the junction-spanning reads sit together at the top of the
pileup.

**Filter by...** has a splicing radio: _Only spliced reads_ keeps just those
reads, and the coverage histogram follows, so what is left is a histogram of the
junction-spanning evidence alone. _Only unspliced reads_ is the complement,
useful for checking intron retention.

**Sashimi arcs → Hide non-canonical junctions** drops every arc whose intron
does not begin and end with GT-AG, GC-AG or AT-AC on either strand. At depth the
thin arcs are mostly these alignment artefacts, and they are what **Sashimi arcs
→ Min read support** cannot remove without also removing a real junction
supported by few reads.

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

## Junction files from the pipeline

The arcs above come from the reads in view. A pipeline's own junction table
carries what the browser cannot compute from one window: counts over the whole
library, an annotated-or-novel flag, portcullis's filtering verdict. Every such
table is a few columns away from BED, and a BED file of introns draws as arcs on
a feature track, so the route is one `awk` line, then `bgzip` and `tabix`.

Each recipe writes one line per junction with the intron as the BED interval,
the read count as the score, the strand, and the tool's own columns after them.
Sorting and indexing is the same for all three:

```bash
sort -k1,1 -k2,2n junctions.bed | bgzip > junctions.bed.gz
tabix -p bed junctions.bed.gz
```

**STAR** writes `SJ.out.tab` with the intron as 1-based inclusive coordinates,
the strand as 0/1/2, the motif as STAR's own code (0 is non-canonical) and the
annotated flag, then the unique and multi-mapping read counts:

```bash
awk -v OFS='\t' '{
  # column 4: 1 = +, 2 = -, 0 = undetermined
  s = $4 == 1 ? "+" : $4 == 2 ? "-" : "."
  # BED is 0-based half-open, so the start moves back one
  print $1, $2 - 1, $3, "junc" NR, $7, s, $5, $6
}' SJ.out.tab > junctions.bed
```

**regtools** `junctions extract` already writes BED12, but its interval is the
anchor span, the reads' aligned flanks around the intron. The two block sizes
trim it back to the intron:

```bash
awk -v OFS='\t' '{
  split($11, b, ",")
  print $1, $2 + b[1], $3 - b[2], $4, $5, $6
}' regtools_junctions.bed > junctions.bed
```

**portcullis** writes a header row naming its columns, so the recipe reads them
by name rather than by position. `nb_raw_aln` is the raw supporting-read count,
`canonical_ss` is `C`, `S` or `N` for canonical, semi-canonical and
non-canonical:

```bash
awk -F'\t' -v OFS='\t' '
  NR == 1 { for (i = 1; i <= NF; i++) c[$i] = i; next }
  {
    # start is 0-based and end is inclusive, so end moves forward one
    print $c["refname"], $c["start"], $c["end"] + 1, "junc_" $c["index"],
      $c["nb_raw_aln"], $c["consensus-strand"], $c["canonical_ss"]
  }
' 3-filt/portcullis_filtered.pass.junctions.tab > junctions.bed
```

The track is a feature track with the arc display picked, and the extra columns
named so a color callback can read them. This is the STAR file, colored by its
annotated flag; the same shape reads `canonical_ss` off the portcullis one:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "star_junctions",
  "name": "Splice junctions (STAR)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://yourhost/junctions.bed.gz",
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "motif",
      "annotated"
    ]
  },
  "displays": [
    {
      "type": "LinearArcDisplay",
      "displayId": "star_junctions-LinearArcDisplay",
      "color": "jexl:get(feature,'annotated')=='1'?'#377eb8':'#e41a1c'",
      "minScore": 3
    }
  ]
}
```

The arc's thickness follows the score by default, its label prints the score at
the apex, and `minScore` is the same read-support floor the sashimi menu offers,
applied to the file's whole-library counts. The extra columns arrive as text, so
the callback compares against `'1'` rather than `1`.

## See also

- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/tutorials/methylation)
- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/gene_track)
- [](/docs/jbrowse_anywidget)
- [Gallery: alignments and long reads](/gallery/#alignments)
