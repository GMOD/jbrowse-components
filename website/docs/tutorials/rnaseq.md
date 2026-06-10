---
title: RNA-seq analysis
description:
  Understand what RNA-seq looks like in the genome browser, from spliced reads
  to splice arcs
guide_category: Tutorials
---

This tutorial is a visual introduction to RNA-seq data in JBrowse 2. It walks
through what RNA-seq reads look like in the genome browser, how spliced
alignments and splice arcs are derived from CIGAR strings, and how short-read
and long-read RNA-seq differ. Every screenshot has a live link so you can open
the same view yourself.

## What does RNA-seq look like in the genome browser?

Here is an RNA-seq BAM file shown in JBrowse 2:

<Figure caption="An RNA-seq BAM file in JBrowse 2. The grey boxes connected by teal lines are reads; the histogram along the top shows read coverage at each position. The orange and green track at top is the reference gene annotation (from a GFF downloaded from NCBI)." src="/img/rnaseq/overview.png" />

[Live demo — RNA-seq BAM overview at ACTB](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr7:5562000-5575000","tracks":["ncbi_gff_hg19","Pairend_StrandSpecific_51mer_Human_hg19"]}]})

The little grey boxes connected by teal lines are the **reads** in the RNA-seq
BAM file. The histogram along the top shows how many reads mapped to a given
position in the genome.

## Zooming in on the reads

Here is what the reads look like when zoomed in:

<Figure caption="RNA-seq reads zoomed in. Each grey box is a single read produced by a DNA sequencer (here, an Illumina machine), and each read corresponds to a fragment of RNA." src="/img/rnaseq/reads_zoomed.png" />

[Live demo — reads zoomed in](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr7:5568000-5569000","tracks":["ncbi_gff_hg19","Pairend_StrandSpecific_51mer_Human_hg19"]}]})

Each little grey box is a read that came from a DNA sequencer — in this case, an
Illumina machine. The important part: each read corresponds directly with a
fragment of RNA. This is why we call it RNA-seq.

## The central dogma

The
[central dogma of molecular biology](https://en.wikipedia.org/wiki/Central_dogma_of_molecular_biology)
tells us that "DNA makes RNA, and RNA makes protein". When we do RNA-seq, we
measure the middle part of this dogma — the RNA part. This gives us insight into
which parts of your DNA are turned into RNA.

## RNA-seq is a quantitative measure of gene expression

RNA-seq is not just a qualitative view of which parts of your genome are
transcribed — it is also a quantitative measure of transcription. If you observe
many reads from a particular area of your genome, that region is highly
expressed.

In the screenshot below, the "compact" visualization is turned on to show the
entire set of reads that stack up. Tools like
[HTSeq](https://htseq.readthedocs.io/en/latest/) can automatically count how
many reads align to each gene (the orange boxes in the genome browser), which
tells you, genome-wide, how much each gene is being expressed.

<Figure caption="The compact visualization showing reads stacking up over a gene. The depth of read coverage is a direct, quantitative measure of expression level." src="/img/rnaseq/compact_stacked.png" />

[Live demo — ACTB read pileup (turn on "compact" from the track menu)](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr7:5566500-5570500","tracks":["ncbi_gff_hg19","Pairend_StrandSpecific_51mer_Human_hg19"]}]})

## RNA-seq is a qualitative measure of gene structure

RNA is transcribed from DNA and then undergoes splicing, which removes intronic
sequences. When you do RNA-seq on these fragments and map them back to the
genome, there are large gaps where the introns were removed. We need tools (like
[STAR](https://github.com/alexdobin/STAR)) that perform a **spliced alignment**.
This means part of an RNA-seq read may get split-mapped, where part of it aligns
to (e.g.) exon 1 and part aligns to exon 2.

Tools like STAR output BAM files (or SAM files — the same idea, but a plaintext
version of a BAM) which describe those spliced alignments using CIGAR strings.

For example, if a read maps partially to exon 1 and partially to exon 2, the
CIGAR string might say:

```
10M 500N 10M
```

(CIGAR strings normally have no spaces; they are added here for readability.)

That means 10 base pairs (`M` for match) of the read aligned to exon 1, then
there is a 500 bp gap (`N` for skip, generally implying a skip over an intronic
region), and another 10 bases (`M`) aligned to exon 2.

## What are the splice arcs in the screenshots?

JBrowse counts, on the fly, all the reads whose CIGAR string contains a skip
(e.g. the `500N` above) and displays each as an arc. From the splicing signal —
the GT/AG dinucleotides surrounding introns — JBrowse can also determine the
strand of the gene. Blue arcs indicate reverse-strand splicing events, and red
arcs indicate forward-strand splicing events.

Recall that DNA is a double helix with a forward and a reverse strand (sometimes
called the Watson and Crick strands; 5'→3' is forward and 3'→5' is reverse).

## Looking at a specific read

With the compact view turned off, you can mouse over a specific read to inspect
it:

<Figure caption="Mousing over a single spliced read. Part of the read aligns to the left exon (grey) and part to the right exon (grey); the black bar in the middle is the skipped intronic region." src="/img/rnaseq/single_read.png" />

[Live demo — single spliced read at ACTB](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr7:5568200-5569200","tracks":["ncbi_gff_hg19","Pairend_StrandSpecific_51mer_Human_hg19"]}]})

The tooltip shows a single read where, as described above, part aligns to the
left exon (grey) and part aligns to the right exon (grey). The black bar in the
middle is the part that is skipped.

## How scientists use RNA-seq

Each of the ~20,000 human protein-coding genes can be **alternatively spliced**,
producing different proteins from different exon combinations. Because
transcription varies by cell type and condition, scientists typically run
RNA-seq across multiple conditions — for example, drought vs. healthy in a plant
— to identify which genes are activated.

## Short reads and long reads

Many RNA-seq files you encounter are **short reads**. This is often Illumina
sequencing, which reads ~150 letters of the RNA (or the DNA version of the RNA).

There are also **long-read** versions of RNA sequencing (from PacBio and
Nanopore). Long-read sequencing can tell you all the letters of a whole gene
transcript at once, whereas short-read sequencing is more like putting together
a puzzle.

Here is what long-read RNA sequencing looks like in JBrowse 2. The data below is
called IsoSeq:

<Figure caption="Long-read (IsoSeq) RNA-seq in JBrowse 2. Long reads often span all of a transcript's exons at once, producing long, clean spliced alignments." src="/img/rnaseq/longread_isoseq.png" />

[Live demo — long-read IsoSeq at ACTB](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=spec-{"views":[{"type":"LinearGenomeView","assembly":"hg19","loc":"chr7:5566000-5571000","tracks":["ncbi_gff_hg19","hg_isoforms.fasta_bam"]}]})

Just as a short read may align partially to exon 1 and exon 2, a long read often
aligns partially to all of the exons. So if you had a gene with five 10 bp exons
separated by 500 bp introns, a long-read CIGAR string might look like:

```
10M 500N 10M 500N 10M 500N 10M 500N 10M
```

Long-read data is very clean compared to short fragmented Illumina sequencing,
but it is more expensive — and since scientists often run many RNA-seq
experiments across different biological conditions, the costs add up.

## Where do you get RNA-seq data?

There is a massive repository of reads on the NCBI
[Sequence Read Archive (SRA)](https://www.ncbi.nlm.nih.gov/sra). Reads on SRA
must be downloaded with a special tool, and you generally get FASTQ — the reads
are not yet aligned to any reference genome (so there are no BAM files), and you
have to align them yourself.

Alternatively, repositories like [ENCODE](https://www.encodeproject.org/) offer
pre-aligned BAM files. Note that human data is often restricted access; only
specially consented datasets such as ENCODE and 1000 Genomes provide BAM files
for humans. This is because you can determine a lot about a person from BAM data
— it is essentially their whole genome — so there are privacy concerns.

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
    "bamLocation": { "uri": "https://yourhost/rnaseq.bam" },
    "index": { "location": { "uri": "https://yourhost/rnaseq.bam.bai" } }
  }
}
```

The splice arcs and per-read splicing shown above come for free from the CIGAR
strings — no extra configuration is needed. For a precomputed coverage signal
(e.g. a strand-specific BigWig produced by your aligner), load it separately as
a [quantitative track](/docs/user_guides/quantitative_track). For the full set
of alignment display options — including paired arcs, soft-clipping, and
coloring — see the [alignments track guide](/docs/user_guides/alignments_track).
