---
title: Bisulfite / EM-seq methylation
description:
  A full Arabidopsis WGBS pipeline — SRA reads through bisulfite alignment to
  per-read CpG/CHG/CHH methylation coloring in JBrowse 2
guide_category: Tutorials
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
```

Load these as a `MultiQuantitativeTrack` exactly as in the
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
the right, a silenced element (the pseudogene **AT1G12935** and the unannotated
repeat sequence beyond it, ~`4,406,000–4,410,000`) is methylated in **all
three** contexts, the signature of transposon/heterochromatin silencing in
plants.

Switching the context re-scores the same reads. Under **CpG** both the gene body
and the element read out red; under **CHG** and **CHH** only the element stays
red while the gene body drops to blue — so the tri-context element separates
cleanly from the CpG-only gene body.

<Figure src="/img/methylation/arabidopsis_wgbs_contexts.png" caption="The same Arabidopsis WGBS pileup colored by bisulfite methylation in the CpG (top), CHG (middle), and CHH (bottom) contexts, over NC_003070.9:4,398,000–4,412,000. Red = methylated cytosine (retained C), blue = unmethylated (C→T). CpG methylation covers both the AT1G12930 gene body (left) and the silenced element (right, ~4,406–4,410 kb); CHG and CHH methylation is confined to the element, leaving the gene body blue. The gray track above each pileup is read coverage." links="CpG context=methylation/arabidopsis_wgbs_cpg,CHG context=methylation/arabidopsis_wgbs_chg,CHH context=methylation/arabidopsis_wgbs_chh" />

Because the call is per read, zooming in resolves the methylation on individual
molecules. The figure below is the ~800 bp right at the gene→element boundary,
colored by **all cytosines** so every C is marked: each read is a run of blue
(unmethylated) cytosines on the gene-body side that turns red (methylated) as it
crosses into the silenced element — the boundary is visible even within single
reads that span it.

<Figure src="/img/methylation/arabidopsis_wgbs_boundary.png" caption="NC_003070.9:4,405,500–4,406,300, bisulfite coloring in the all-cytosines context. Each read carries a per-base methylation call: blue (unmethylated, C→T) cytosines dominate the gene body on the left, and red (methylated) cytosines appear as reads cross into the silenced element on the right, where methylation rises from ~0% to ~90%." />

## See also

- [DNA methylation](/docs/tutorials/methylation) — per-read methylation from
  long-read modBAM (MM/ML tags), haplotype-grouped and imprinting examples
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  loading the MethylDackel bedGraphs as an aggregate methylation-fraction track
- [Alignments track](/docs/user_guides/alignments_track) — the track menu,
  coloring, and sorting options used above
