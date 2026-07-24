---
title: Methylation (bisulfite)
description:
  A WGBS/EM-seq pipeline from SRA reads to per-read CpG/CHG/CHH methylation
  coloring
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

Bisulfite sequencing (WGBS) and its enzymatic cousin EM-seq read DNA methylation
without any long-read basecaller. A chemical (sodium bisulfite) or enzymatic
(APOBEC) step converts every unmethylated cytosine to uracil, which reads as T,
while a methylated cytosine is protected and still reads as C. So you can
recover methylation from ordinary short Illumina reads just by comparing each
read to the reference: a C→T change at a cytosine means it was unmethylated, and
a retained C means it was methylated.

JBrowse 2 reads all of this straight off the aligned reads through its bisulfite
color mode (no MM/ML tags and no external methylation caller needed to color the
pileup). This tutorial runs the whole pipeline on real _Arabidopsis thaliana_
data, from SRA reads to a colored browser view.

Plants make a compelling example here. Mammals methylate almost entirely at CpG,
but plants also methylate cytosines in three sequence contexts: CpG, CHG, and
CHH (where H is A, C, or T). JBrowse can restrict the coloring to any one
context, so you can see all three on the same reads.

## What you need

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
rows, the Aggregate methylation track in the figure below. This is the same
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
        "bigWigLocation": { "uri": "arabidopsis_wgbs_CpG.bw" }
      },
      {
        "type": "BigWigAdapter",
        "name": "CHG",
        "color": "green",
        "bigWigLocation": { "uri": "arabidopsis_wgbs_CHG.bw" }
      },
      {
        "type": "BigWigAdapter",
        "name": "CHH",
        "color": "blue",
        "bigWigLocation": { "uri": "arabidopsis_wgbs_CHH.bw" }
      }
    ]
  }
}
```

## Loading into JBrowse

Both views below read from the `arabidopsis_wgbs.bam` produced above, so add it
alongside the TAIR10 assembly it was aligned to.

Set up the assembly from the same `tair10.fa` reference (the CLI indexes and
bgzips it for you):

```bash
jbrowse add-assembly tair10.fa --name tair10 --load copy
```

Then add the alignments track. The per-read bisulfite coloring is a property of
this track, no separate configuration:

```json
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

The figure's top row is the TAIR10 gene models. They come with the reference
(`datasets download genome accession GCF_000001735.4 --include gff3`). Sort,
compress, and index the GFF3, then add it as a `FeatureTrack`:

```bash
jbrowse sort-gff genomic.gff | bgzip > tair10.gff.gz
tabix -p gff tair10.gff.gz
jbrowse add-track tair10.gff.gz --name "TAIR10 genes" --load copy
```

The Aggregate methylation row is the optional MethylDackel track from the
section above. Load it too if you built the bigWigs, or leave it out. The
per-read coloring below stands on its own.

**Using JBrowse Desktop?** Every step here works identically on Desktop, which
opens `tair10.fa`, the BAM, and the bigWigs straight from your local disk with
no web server. See the [desktop quickstart](/docs/quickstart_desktop).

## Coloring reads in JBrowse

Open the alignments track and, from the track menu, choose **Color by →
Bisulfite / EM-seq**, then pick a cytosine context (CpG, CHG, CHH, or all
cytosines). Methylated cytosines paint red, and the same submenu's **Show
unmethylated (blue)** toggle adds the converted sites in blue. It's
reference-based and only makes sense for bisulfite/EM-seq libraries. No MM/ML
tags are involved.

The figures below leave **Show unmethylated** off, so methylation reads directly
as the presence of red and the three contexts contrast cleanly without the blue.

Type `NC_003070.9:4,398,000-4,412,000` into the location box to reach the window
below (chromosome 1). It places two methylation regimes side by side: a gene
body methylated only in the CpG context (left), and a silenced element
methylated in all three contexts (right).

<Figure caption="TAIR10 genes, the aggregate MethylDackel track (one 0-100% row per context), and three copies of the same WGBS pileup colored by CpG, CHG, and CHH. The gene body AT1G12930 is red in the CpG row only, while the silenced element to its right is red in all three." src="/img/methylation/arabidopsis_wgbs_contexts.png" />

Each per-read copy is the same alignment track re-colored for one context.
Because the call is made per read, zooming in to the gene→element boundary lets
you follow the methylation on individual molecules.

<Figure caption="The same three pileups zoomed to the boundary between AT1G12930 and the silenced element, with taller reads. In the CHG and CHH copies a read stays blank while it covers the gene body and picks up red marks where it crosses into the element." src="/img/methylation/arabidopsis_wgbs_boundary.png" />

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
pre-colored Bisulfite / CpG, opening on the window above. It requires:

- the NCBI `datasets` CLI
- `wget`
- [Trim Galore](https://www.bioinformatics.babraham.ac.uk/projects/trim_galore/)
- [bwameth](https://github.com/brentp/bwa-meth)
- `samtools`
- htslib (`bgzip`, `tabix`)
- `node`

On Debian/Ubuntu, `apt install wget samtools tabix` covers several of these.
bwameth, Trim Galore, and the NCBI
[`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
CLI install from their own instructions, and `node` comes from
[nodejs.org](https://nodejs.org/). The alignment step downloads a full WGBS run,
so allow time and disk for it. The optional MethylDackel aggregate track above
is left out of the script. Add it by hand if you want it.

## See also

- [Long-read methylation](/docs/tutorials/methylation)
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track)
- [Alignments track](/docs/user_guides/alignments_track)
