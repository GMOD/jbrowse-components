---
title: Bisulfite / EM-seq methylation
description:
  A full Arabidopsis WGBS pipeline — SRA reads through bisulfite alignment to
  per-read CpG/CHG/CHH methylation coloring in JBrowse 2
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Bisulfite sequencing (WGBS) and its enzymatic cousin EM-seq read DNA methylation
without any long-read basecaller: a chemical (sodium bisulfite) or enzymatic
(APOBEC) step converts every **unmethylated** cytosine to uracil — read as **T**
— while a **methylated** cytosine is protected and still reads as **C**. So
methylation is recoverable from short Illumina reads by comparing each read to
the reference: a C→T change at a cytosine means unmethylated, a retained C means
methylated.

JBrowse 2 reads this directly off the aligned reads — no MM/ML tags, no external
methylation caller needed to color the pileup — via the **bisulfite** color
mode. This tutorial runs the whole pipeline on real _Arabidopsis thaliana_ data,
from SRA reads to a colored browser view.

Plants make this a compelling example: unlike mammals (methylation almost
entirely at **CpG**), plants methylate cytosines in **three** sequence contexts
— **CpG**, **CHG**, and **CHH** (H = A, C, or T) — each maintained by a
different pathway. JBrowse can restrict the coloring to any one context, so all
three are visible on the same reads.

## The pipeline

### Get the reference and reads

We use the TAIR10 reference and one wild-type Col-0 WGBS run
([`DRR029742`](https://www.ebi.ac.uk/ena/browser/view/DRR029742), paired-end 150
bp, HiSeq 2500).

```bash
# reference (TAIR10)
datasets download genome accession GCF_000001735.4 --include genome
# ... unzip; call it tair10.fa

# reads, straight from ENA (or use prefetch + fasterq-dump from SRA)
wget https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR029/DRR029742/DRR029742_1.fastq.gz
wget https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR029/DRR029742/DRR029742_2.fastq.gz
```

### Trim adapters (recommended)

WGBS libraries benefit from adapter and low-quality trimming before alignment:

```bash
trim_galore --paired DRR029742_1.fastq.gz DRR029742_2.fastq.gz
```

### Bisulfite-align with bwameth

[bwameth](https://github.com/brentp/bwa-meth) aligns bisulfite reads by
in-silico C→T converting both reads and reference, then running `bwa mem`. It
emits an ordinary BAM with the **original** read sequences, so the C→T signal is
preserved for JBrowse to read.

```bash
bwameth.py index tair10.fa
bwameth.py --reference tair10.fa -t 8 \
    DRR029742_1_val_1.fq.gz DRR029742_2_val_2.fq.gz \
  | samtools sort -@4 -o arabidopsis_wgbs.bam -
samtools index arabidopsis_wgbs.bam
```

(Bismark is an equally common choice, especially in the plant community; JBrowse
reads Bismark BAMs the same way.)

### (Optional) Aggregate methylation calling

For a whole-genome, per-position methylation **fraction** track — complementary
to the per-read coloring — call methylation with
[MethylDackel](https://github.com/dpryan79/MethylDackel), which understands all
three plant contexts:

```bash
MethylDackel extract --CHG --CHH tair10.fa arabidopsis_wgbs.bam
# -> *_CpG.bedGraph, *_CHG.bedGraph, *_CHH.bedGraph
# convert each to bigWig (bedGraphToBigWig, UCSC tools) for fast random access
```

Group the three bigWigs into one `MultiQuantitativeTrack` (a subadapter per
context, each with its own `name` and `color`) so they render as three labeled
rows — the **Aggregate methylation** track in the figure below. This is the same
mechanism as the
[DNA methylation tutorial's aggregate section](/docs/tutorials/methylation#aggregate-methylation-with-modkit-bedmethyl).

## Coloring reads in JBrowse

Open the alignments track and, from the track menu, choose **Color by → Advanced
→ Bisulfite / EM-seq**, then pick a cytosine context (CpG, CHG, CHH, or all
cytosines). Methylated cytosines paint **red**, unmethylated **blue**. (It is
under **Advanced** because it is reference-based and only meaningful for
bisulfite/EM-seq libraries — no MM/ML tags are involved.)

The demo view opens on `NC_003070.9` (chromosome 1) around
`4,398,000–4,412,000`, a window that places two methylation regimes side by
side. On the left, the expressed ARM-repeat gene **AT1G12930** carries
**gene-body methylation** — cytosines methylated only in the **CpG** context. On
the right, a silenced element (the pseudogene **AT1G12935** and the repeat
sequence beyond it) is methylated in **all three** contexts, the signature of
transposon/heterochromatin silencing in plants.

The figure below stacks two tracks over that window so the pattern reads at a
glance: the **gene annotation** for context and the **aggregate methylation**
track, with one row per context (from MethylDackel — see the previous section).
CpG methylation covers both the gene body and the silenced element, while CHG and
CHH methylation is confined to the element — so the tri-context element separates
cleanly from the CpG-only gene body.

<Figure src="/img/methylation/arabidopsis_wgbs_contexts.png" caption="Arabidopsis WGBS over NC_003070.9:4,398,000–4,412,000. Top: the AT1G12930 gene and the AT1G12935 pseudogene. Bottom: aggregate per-position methylation in the three plant contexts — CpG (red) covers both the gene body and the silenced element (right), while CHG (orange) and CHH (blue) are confined to the element." />

Those aggregate rows are computed from the per-read bisulfite pileup — the same
reads you can color directly. Switching a pileup's context (**Color by →
Advanced → Bisulfite / EM-seq**, then CpG / CHG / CHH / all) re-scores every read
against the chosen context; **all cytosines** marks every C at once.

Because the call is per read, zooming in resolves the methylation on individual
molecules. The figure below is the gene→element boundary, colored by **all
cytosines** so every C is marked: each read is a run of blue (unmethylated)
cytosines on the gene-body side that turns red (methylated) as it crosses into
the silenced element — the boundary is visible even within single reads that
span it.

<Figure src="/img/methylation/arabidopsis_wgbs_boundary.png" caption="The gene→element boundary (~3 kb). Every cytosine on every read is colored: blue (unmethylated, C→T) dominates the AT1G12930 gene body on the left, and reads turn red (methylated) as they cross into the silenced element on the right. The boundary is visible even within single reads that span it, and in the coverage histogram above." />

## See also

- [DNA methylation](/docs/tutorials/methylation) — per-read methylation from
  long-read modBAM (MM/ML tags), haplotype-grouped and imprinting examples
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  loading the MethylDackel bedGraphs as an aggregate methylation-fraction track
- [Alignments track](/docs/user_guides/alignments_track) — the track menu,
  coloring, and sorting options used above
