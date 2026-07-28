---
title: Methylation (bisulfite)
description:
  A WGBS/EM-seq pipeline from SRA reads to per-read CpG/CHG/CHH methylation
  coloring
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

**TL;DR:** align WGBS/EM-seq short reads with bwameth, load the plain BAM, and
JBrowse colors per-read methylation straight from the C→T conversion, with CpG,
CHG, and CHH each selectable. No MM/ML tags and no methylation caller.

## Prerequisites

This is a full command-line pipeline:

- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI, and `wget`
- [Trim Galore](https://www.bioinformatics.babraham.ac.uk/projects/trim_galore/)
  (with cutadapt)
- [bwameth](https://github.com/brentp/bwa-meth) and
  [samtools](http://www.htslib.org/)
- htslib (`bgzip`, `tabix`), and `node` for the [JBrowse CLI](/docs/cli)
- [MethylDackel](https://github.com/dpryan79/MethylDackel) and UCSC's
  `bedGraphToBigWig`, for the optional aggregate track only

Bisulfite sequencing (WGBS) and its enzymatic cousin EM-seq read DNA methylation
without any long-read basecaller. A chemical (sodium bisulfite) or enzymatic
(APOBEC) step converts every unmethylated cytosine to uracil, which reads as T,
while a methylated cytosine is protected and still reads as C. Methylation is
therefore recoverable from ordinary short Illumina reads by comparing each read
to the reference: a C→T change at a cytosine means it was unmethylated, a
retained C means it was methylated.

JBrowse 2 makes that comparison itself, per read, at render time. Nothing in the
BAM has to carry a methylation call.

Plants are the interesting case, and the one this tutorial uses. Mammals
methylate almost entirely at CpG, but plants methylate in three sequence
contexts: CpG, CHG, and CHH (H is A, C, or T). JBrowse restricts the coloring to
any one of them, so all three read off the same pileup. Everything below runs on
real _Arabidopsis thaliana_ data, from SRA reads to a colored browser view.

## The pipeline

### Get the reference and reads

We use the TAIR10 reference and one wild-type Col-0 WGBS run
([`DRR029742`](https://www.ebi.ac.uk/ena/browser/view/DRR029742), paired-end 150
bp, HiSeq 2500). The `datasets download` writes a zip with the genome nested a
few directories deep, so unzip it and rename the `.fna` to `tair10.fa`:

```bash
# reference (TAIR10), via the NCBI datasets CLI
datasets download genome accession GCF_000001735.4 --include genome
unzip ncbi_dataset.zip
mv ncbi_dataset/data/GCF_000001735.4/*.fna tair10.fa

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
emits an ordinary BAM with the original read sequences, so the C→T signal is
preserved for JBrowse to read.

```bash
bwameth.py index tair10.fa
bwameth.py --reference tair10.fa -t 8 \
    DRR029742_1_val_1.fq.gz DRR029742_2_val_2.fq.gz \
  | samtools sort -@4 -o arabidopsis_wgbs.bam -
samtools index arabidopsis_wgbs.bam
```

(The `_val_1`/`_val_2` inputs are Trim Galore's outputs from the previous step.
If you skipped trimming, pass the raw
`DRR029742_1.fastq.gz DRR029742_2.fastq.gz` instead. Bismark is an equally
common aligner, especially in the plant community. JBrowse reads Bismark BAMs
the same way.)

### (Optional) Aggregate methylation calling

For a whole-genome, per-position methylation fraction track, complementary to
the per-read coloring, call methylation with
[MethylDackel](https://github.com/dpryan79/MethylDackel), which understands all
three plant contexts:

```bash
MethylDackel extract --CHG --CHH tair10.fa arabidopsis_wgbs.bam
# -> arabidopsis_wgbs_CpG.bedGraph, _CHG.bedGraph, _CHH.bedGraph

# bedGraphToBigWig needs a chrom.sizes; derive it from the reference
samtools faidx tair10.fa
cut -f1,2 tair10.fa.fai > tair10.chrom.sizes

# convert each context to bigWig for fast random access
for ctx in CpG CHG CHH; do
  sort -k1,1 -k2,2n arabidopsis_wgbs_$ctx.bedGraph > arabidopsis_wgbs_$ctx.sorted.bedGraph
  bedGraphToBigWig arabidopsis_wgbs_$ctx.sorted.bedGraph tair10.chrom.sizes arabidopsis_wgbs_$ctx.bw
done
```

Group the three bigWigs into one `MultiQuantitativeTrack` (a subadapter per
context, each with its own `name` and `color`) so they render as three labeled
rows, the Aggregate methylation track in the figures below. This is the same
mechanism as the
[DNA methylation tutorial's aggregate section](/docs/tutorials/methylation#aggregate-methylation-with-modkit-bedmethyl).

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "arabidopsis_wgbs_methyldackel",
  "name": "Aggregate methylation (MethylDackel)",
  "assemblyNames": ["tair10"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "CpG",
        "color": "red",
        "uri": "arabidopsis_wgbs_CpG.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CHG",
        "color": "green",
        "uri": "arabidopsis_wgbs_CHG.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CHH",
        "color": "blue",
        "uri": "arabidopsis_wgbs_CHH.bw"
      }
    ]
  }
}
```

## Load the tracks

The figures below use three tracks: the TAIR10 assembly, its gene models, and
the `arabidopsis_wgbs.bam` produced above.

Set up the assembly from the same `tair10.fa` reference (the CLI indexes and
bgzips it for you):

```bash
jbrowse add-assembly tair10.fa --name tair10 --load copy
```

The gene models come with the reference
(`datasets download genome accession GCF_000001735.4 --include gff3`). Sort,
compress, and index the GFF3, then add it as a `FeatureTrack`:

```bash
jbrowse sort-gff genomic.gff | bgzip > tair10.gff.gz
tabix -p gff tair10.gff.gz
jbrowse add-track tair10.gff.gz --name "TAIR10 genes" --load copy
```

Then add the alignments track. The per-read bisulfite coloring is a property of
this track, no separate configuration:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "arabidopsis_wgbs",
  "name": "Arabidopsis WGBS (bwameth)",
  "assemblyNames": ["tair10"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "arabidopsis_wgbs.bam"
  }
}
```

See the [assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent assembly JSON.

The Aggregate methylation row in the figures is the optional MethylDackel track
from the section above. Load it too if you built the bigWigs, or leave it out.
The per-read coloring stands on its own.

**Using JBrowse Desktop?** Every step here works identically on Desktop, which
opens `tair10.fa`, the BAM, and the bigWigs straight from your local disk with
no web server. See the [desktop quickstart](/docs/quickstart_desktop).

## Color the reads

In the alignments track menu, pick **Color by** then **Bisulfite / EM-seq**,
then a cytosine context: **CpG**, **CHG**, **CHH**, or **All cytosines**.
Methylated cytosines paint red, and **Show unmethylated (blue)** adds the
converted sites in blue. The mode is reference-based, so it only means anything
on a bisulfite or EM-seq library.

The figures below leave **Show unmethylated** off, so methylation reads as
presence of red and the three contexts contrast without a red/blue mix on every
read.

## Two methylation regimes

Plants run two unrelated methylation programs, and the three contexts are what
tell them apart:

| Program                         | CpG | CHG | CHH | Effect on the locus                                                                              |
| ------------------------------- | --- | --- | --- | ------------------------------------------------------------------------------------------------ |
| Gene body methylation (gbM)     | yes | no  | no  | None obvious, the gene stays transcribed. Maintained by MET1, depleted at the TSS and the 5' end |
| Transposon and repeat silencing | yes | yes | yes | Heterochromatin, transcriptionally off. CMT3 maintains CHG, RdDM and CMT2 maintain CHH           |

So red in the CpG row alone is gene body methylation, and red in all three rows
is silencing. A mammalian dataset only ever populates the first column, which is
what makes the CHG and CHH rows a plant-specific readout.

Type `NC_003070.9:4,398,000-4,412,000` into the location box to reach a window
on chromosome 1 that carries one of each: the expressed gene AT1G12930 on the
left, and a silenced element on the right (the AT1G12935 pseudogene and the
repeat sequence around it). This run's own MethylDackel calls, as the methylated
fraction of all calls in each context:

| Region                                   | CpG | CHG  | CHH  |
| ---------------------------------------- | --- | ---- | ---- |
| AT1G12930 gene body, 4,398,322-4,405,669 | 31% | 0.4% | 0.5% |
| Silenced element, 4,406,000-4,410,000    | 89% | 69%  | 27%  |

<Figure caption="TAIR10 genes, the aggregate MethylDackel track (one 0-100% row per context), and three copies of the same WGBS pileup colored by CpG, CHG, and CHH. AT1G12930 on the left is red in CpG only, at both levels. The silenced element on the right is red in all three." src="/img/methylation/arabidopsis_wgbs_contexts.png" />

## Reproduce it end to end

The whole pipeline is wrapped in one script,
[`build_arabidopsis_wgbs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_arabidopsis_wgbs.sh):

```bash
bash scripts/build_arabidopsis_wgbs.sh          # builds ./arabidopsis_wgbs_build/jbrowse2
npx --yes serve arabidopsis_wgbs_build/jbrowse2 # then open the printed URL
```

It downloads the TAIR10 reference and the DRR029742 WGBS run, trims and
bisulfite-aligns them with bwameth, downloads JBrowse, and writes a
`config.json` with the assembly, the gene models, and the per-read pileup
pre-colored Bisulfite / CpG, opening on the window above. The aggregate
MethylDackel track is left out, so it needs everything under
[What you need](#what-you-need) except MethylDackel and `bedGraphToBigWig`.

On Debian/Ubuntu, `apt install wget samtools tabix` covers several of those.
bwameth, Trim Galore, and the NCBI `datasets` CLI install from their own
instructions, and `node` comes from [nodejs.org](https://nodejs.org/). The
alignment step downloads a full WGBS run, so allow time and disk for it.

## See also

- [Long-read methylation](/docs/tutorials/methylation)
- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/alignments_track)
