---
title: RNA-seq visualization
description: Spliced reads, splice arcs, and strand-specific coverage in RNA-seq
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

An RNA-seq read mapped back to the genome jumps the introns spliced out of the
transcript, and the aligner records each jump in the read's CIGAR string. In a
stranded library the pair flags also mark which strand the transcript came from.
JBrowse draws splice arcs and strand coloring from those two BAM fields, with no
extra files or configuration. We read spliced alignments over _ACTB_, transcript
strand at the surfeit locus and a long-read alignment, and then load a
pipeline's junction table as a track.

## Prerequisites

- for your own reads, an aligned, sorted and indexed BAM or CRAM from a spliced
  aligner
- a JBrowse instance to load it into: the [web quickstart](/docs/quickstart_web)
  or the [desktop quickstart](/docs/quickstart_desktop)

## Where the data comes from

The hg19 alignments, gene models and junction table behind the figures, hosted
on jbrowse.org's demo bucket.

Nothing to download: the track configs below read these files by URL.

<details>
<summary>The files</summary>

- the paired-end stranded RNA-seq alignments behind every short-read figure on
  this page, from the sample files listed at
  [RSeQC](https://rseqc.sourceforge.net/):
  https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam

</details>

## Loading hg19, the stranded reads and RefSeq genes

The alignments are against hg19, so we load that assembly, with an alias file
that resolves the chromosome names in the BAM and the gene models to the
assembly's, then the stranded paired-end reads and the RefSeq gene models, each
with its index beside it:

```json addassembly
{
  "name": "hg19",
  "uri": "https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/ucsc/hg19/cytoBandIdeo.bed.gz"
}
```

```json addtrack loc=chr7:5,567,000-5,570,000
{
  "trackId": "rnaseq_paired_stranded",
  "name": "Paired-end stranded RNA-seq (RSeQC sample)",
  "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/paired_end_rnaseq/Pairend_StrandSpecific_51mer_Human_hg19.bam",
  "assemblyNames": ["hg19"]
}
```

```json addtrack
{
  "trackId": "ncbi_refseq_hg19",
  "name": "NCBI RefSeq genes (hg19)",
  "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/ncbi_refseq/GRCh37_latest_genomic.sort.gff.gz",
  "assemblyNames": ["hg19"]
}
```

## Loading your own RNA-seq data

An aligned, sorted and indexed BAM or CRAM loads as an `AlignmentsTrack` from
one `uri`, and JBrowse finds the `.bai` or `.crai` beside the file:

```json addtrack
{
  "trackId": "my_rnaseq",
  "name": "My RNA-seq",
  "uri": "https://yourhost/rnaseq.bam",
  "assemblyNames": ["hg38"]
}
```

Your own reads load like the track above once four things are in place:

- **Assembly.** `assemblyNames` must match an assembly already configured in
  JBrowse; see the
  [assemblies configuration guide](/docs/config_guides/assemblies).
- **Alignment.** Align reads with a spliced aligner such as STAR, then
  `samtools sort` and `samtools index` so the `.bai` sits beside the BAM.
- **Options.** The
  [alignments track config guide](/docs/config_guides/alignments_track) covers
  adapter and display options.
- **Coverage signal.** A precomputed signal, such as a strand-specific BigWig
  from the aligner, loads separately as a
  [quantitative track](/docs/user_guides/quantitative_track).

## What RNA-seq looks like in the genome browser

Type `chr7:5,567,000-5,570,000` into the location box. The gene there is _ACTB_,
a compact gene with deep, even read coverage.

The thin teal lines jumping across a gap are spliced alignments, where a read
maps partly to one exon and partly to the next, skipping the intron between
them.

<Figure caption="RNA-seq reads over ACTB under the NCBI RefSeq gene model: the coverage histogram with strand-colored splice arcs, then the spliced read pileup." src="/img/rnaseq/basic.png" />

## Read coverage and read height

The histogram counts the reads in the pileup below it at each position. Pick
**Read height → Compact** in the track menu to pack the full read stack into
view:

<Figure caption="ACTB under compact read height: the whole read stack fits the track, under the per-position coverage histogram and the hg19 NCBI RefSeq gene model." src="/img/rnaseq/compact_stacked.png" />

## Spliced reads, CIGAR strings, and splice arcs

A spliced aligner like [STAR](https://github.com/alexdobin/STAR) split-maps a
read that crosses an intron and encodes the skip in its CIGAR string, the
SAM/BAM field describing how a read aligns to the reference.

A spliced read in the _ACTB_ pileup (reads here are 51 bp) has a CIGAR like
this, spaced out for readability:

```text
18M 95N 33M
```

The CIGAR reads as 18 bp (`M`, match) aligned to one exon, a 95 bp skip (`N`)
across the intron, and 33 bp (`M`) aligned to the next. Every `N` in a read's
CIGAR is one skipped intron.

JBrowse computes the arcs on the fly from the skips in the reads in view, and
colors each arc by transcript strand, salmon for forward and purple for reverse,
the colors the reads of each strand take. It finds the strand two ways:

- **Tags.** `XS` and `TS` record the strand directly. minimap2's `ts` is
  relative to the read, so JBrowse combines it with the strand the read aligned
  to.
- **Splice motif.** A BAM from STAR without `--outSAMstrandField intronMotif`
  has no tags, so JBrowse reads the first and last two bases of the intron off
  the reference: GT-AG on the forward strand reads as CT-AC on the reverse. A
  junction whose reads disagree, or whose motif is none of GT-AG, GC-AG and
  AT-AC, draws in the neutral color. Hovering an arc shows the motif beside the
  read count.

## Picking out spliced reads in a deep pileup

In a deep pileup, reads with a skip sit among many more that have none, so the
splicing evidence is hard to see. Three track-menu settings pull it out.

**Sort by... → Spliced reads first** gives every read whose CIGAR has a skip the
lowest rows, so the junction-spanning reads sit together at the top of the
pileup.

<Figure caption="The ACTB pileup in file order above, and sorted with spliced reads first below. Teal lines mark reads whose CIGAR has a skip. File order scatters them down the stack, and the sort gathers them into the top rows." src="/img/rnaseq/sort_spliced_first.png" links="File order=rnaseq/deep_pileup_file_order,Spliced first=rnaseq/deep_pileup_spliced_first" />

**Filter by... → Spliced reads → Only spliced reads** keeps just those reads,
and the coverage histogram follows, so what is left is a histogram of the
junction-spanning evidence alone. **Hide spliced reads** in the same submenu is
the complement.

**Sashimi arcs → Hide non-canonical junctions** drops every arc whose intron
does not begin and end with GT-AG, GC-AG or AT-AC on either strand. Raising
**Sashimi arcs → Min read support** also drops thin arcs, along with any real
junction few reads support.

<Figure caption="Every junction the reads have above, and only the canonical ones below. The motif filter drops the two salmon arcs around the leftmost intron and keeps the purple ones, whose introns the gene model also draws." src="/img/rnaseq/hide_non_canonical.png" links="All junctions=rnaseq/sashimi_all_junctions,Canonical only=rnaseq/sashimi_canonical_only" />

## Strand-specific RNA-seq

Splice-arc colors give the strand of spliced reads. A _strand-specific_ library
records the transcript strand in which mate of the pair a read is, so every read
has it, which separates genes close together or overlapping on opposite strands.

The surfeit locus is a tight cluster of genes on alternating strands (_RPL7A_,
_SURF1_, _SURF2_, _SURF4_). Type `chr9:136,214,000-136,229,000` into the
location box, then pick this path from the track menu:

**Color by... → Paired end → First-of-pair strand**

<Figure caption="The surfeit locus colored by first-of-pair strand. The pileup splits into two colors, and the switch falls where the genes change strand: RPL7A forward, SURF1 reverse, SURF2 forward." src="/img/rnaseq/strand_specific.png" />

Grouping the reads by first-of-pair strand shows transcript strand over a whole
gene. Pick **Group by... → First-of-pair strand** to draw one band per group,
each with a coverage histogram from only that group's reads, forward and reverse
on one autoscaled axis. Turning off **Show... → Show pileup** leaves the two
histograms alone.

On chr6, _NELFE_ and _SKIV2L_ sit back to back on opposite strands. Type
`chr6:31,920,500-31,933,000` into the location box:

<Figure caption="NELFE and SKIV2L, adjacent and on opposite strands, grouped by first-of-pair strand: each band shows signal over exactly one of the two genes." src="/img/rnaseq/strand_split_coverage.png" />

## Long-read splicing: IsoSeq over ACTB

A long read (PacBio IsoSeq, Nanopore) often spans a whole transcript, aligning
across every exon with one `N` skip per intron. JBrowse derives the same arcs
and connectors from those skips. The IsoSeq alignments are a second BAM on the
same assembly:

```json addtrack loc=chr7:5,567,000-5,570,000
{
  "trackId": "alzheimers_isoseq",
  "name": "IsoSeq high-quality isoforms",
  "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/hg19/alzheimers_isoseq/hq_isoforms.fasta.bam",
  "assemblyNames": ["hg19"]
}
```

<Figure caption="IsoSeq high-quality isoforms over ACTB. A long read often spans all of a transcript's exons, so one spliced alignment covers the whole transcript." src="/img/rnaseq/longread_isoseq.png" />

## Loading STAR, regtools and portcullis junction tables

A junction table from an RNA-seq pipeline adds values JBrowse cannot compute
from the reads in view: whole-library read counts, an annotated-or-novel flag,
or portcullis's filtering verdict. One `awk` line converts each table to BED,
which draws as arcs on a feature track, with the intron as the interval, the
read count as the score, the strand, and the tool's own columns after them. Sort
and index all three the same way:

```bash
sort -k1,1 -k2,2n junctions.bed | bgzip > junctions.bed.gz
tabix -p bed junctions.bed.gz
```

**STAR** writes `SJ.out.tab` with the intron as 1-based inclusive coordinates,
then the strand, the motif as a STAR code (0 is non-canonical), the annotated
flag and the unique and multi-mapping read counts:

```bash
awk -v OFS='\t' '{
  # column 4: 1 = +, 2 = -, 0 = undetermined
  s = $4 == 1 ? "+" : $4 == 2 ? "-" : "."
  # BED is 0-based half-open, so the start moves back one
  print $1, $2 - 1, $3, "junc" NR, $7, s, $5, $6
}' SJ.out.tab > junctions.bed
```

**regtools** reads the junctions straight out of the BAM, then annotates each
against a GTF with its splice-site motif and whether an annotated transcript
joins that donor to that acceptor. The annotated table has a header row and
gives the last base of one exon and the first base of the next, so the intron
ends one base before `end`:

<!-- from: scripts/build_rnaseq_junctions.sh -->

```bash
# -s FR: a stranded library whose first read runs along the transcript;
#   RF for a dUTP library
regtools junctions extract -s FR rnaseq.bam -o regtools.bed
# annotate reads a plain GTF, not a gzipped one
regtools junctions annotate regtools.bed genome.fa genes.gtf -o annotated.tsv
# column 7 is the motif, column 14 the known-junction flag
awk -F'\t' -v OFS='\t' 'NR > 1 { print $1, $2, $3 - 1, $4, $5, $6, $7, $14 }' \
  annotated.tsv > junctions.bed
```

**portcullis** writes a header row naming its columns, so the recipe reads them
by name. `nb_raw_aln` is the raw supporting-read count, `canonical_ss` is `C`,
`S` or `N` for canonical, semi-canonical and non-canonical:

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

This config loads the regtools file built from this page's BAM as a feature
track whose `link` mark draws each junction, coloured by the known-junction flag
against RefSeq. `columnNames` names the extra columns so the colour encoding can
read them:

```json addtrack loc=chr11:49,220,500-49,231,500
{
  "type": "FeatureTrack",
  "trackId": "rnaseq_junctions_hg19",
  "name": "Splice junctions (regtools)",
  "category": ["RNA-seq"],
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/rnaseq/rnaseq_junctions.bed.gz",
    "columnNames": [
      "chrom",
      "chromStart",
      "chromEnd",
      "name",
      "score",
      "strand",
      "splice_site",
      "known_junction"
    ]
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "rnaseq_junctions_hg19-LinearMarkDisplay",
      "transform": [
        {
          "type": "filter",
          "expr": "jexl:feature.score >= 3 && feature.splice_site in ['GT-AG', 'GC-AG', 'AT-AC']"
        }
      ],
      "marks": [
        {
          "mark": "link",
          "encoding": {
            "size": { "field": "score", "scale": "log", "range": [1, 8] },
            "color": {
              "field": "known_junction",
              "scale": "categorical",
              "domain": ["1", "0"],
              "range": ["#377eb8", "#e41a1c"],
              "labels": ["annotated", "novel"],
              "title": "RefSeq"
            }
          }
        },
        { "mark": "text", "encoding": { "text": "score" }, "maxBpPerPx": 50 }
      ]
    }
  ]
}
```

The `filter` applies the sashimi menu's read-support floor to the whole-library
counts in the file and keeps the canonical motifs, which drops the duplicate
that wrong-strand reads give a junction on the opposite strand. The colour's
`domain` lists the `known_junction` values as strings because the adapter reads
extra columns as text.

Type `chr11:49,220,500-49,231,500` into the location box, the 5' end of _FOLH1_,
where the file separates what RefSeq annotates from what this library also
splices:

<Figure caption="The 5' end of FOLH1 on hg19: RefSeq transcripts above, the library's junctions below, blue where an annotated transcript joins the two ends and red where none does. The large red arc joins a donor and an acceptor RefSeq uses, skipping the exons between them, and it is about as thick as the blue arcs beside it." src="/img/rnaseq/junction_track.png" links="Open this view=rnaseq/junction_track" />

For the STAR file, the `columnNames` end in `motif` and `annotated`, and the
colour's `field` is `annotated`. For the portcullis file, the colour's `field`
is `canonical_ss`, its `domain` `["C", "S", "N"]`, and its `labels` canonical,
semi-canonical and non-canonical, with a third colour in `range`. **Edit
plot...** in the track menu edits the same marks, colours and filter on a track
already open.

## See also

- [](/docs/tutorials/dtu)
- [](/docs/tutorials/scrna_pseudobulk)
- [](/docs/tutorials/methylation)
- [](/docs/tutorials/gene_prediction_review)
- [](/docs/tutorials/alphagenome)
- [](/docs/user_guides/alignments_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/gene_track)
- [](/docs/jbrowse_anywidget)
