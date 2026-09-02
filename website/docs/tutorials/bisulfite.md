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

- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI, and `wget`
- [Trim Galore](https://www.bioinformatics.babraham.ac.uk/projects/trim_galore/)
  (with cutadapt)
- [bwameth](https://github.com/brentp/bwa-meth)
- [samtools](http://www.htslib.org/)
- htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)
- [MethylDackel](https://github.com/dpryan79/MethylDackel), for the
  [conversion-rate check](#check-the-conversion-rate) and the optional aggregate
  track
- UCSC's `bedGraphToBigWig`, for the optional aggregate track only

## Where the data comes from

TAIR10 (RefSeq `GCF_000001735.4`) and one wild-type Col-0 WGBS run from the
European Nucleotide Archive, `DRR029742` (paired-end 150 bp).

- the TAIR10 reference and its gene models, fetched by accession with the
  `datasets` CLI:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/735/GCF_000001735.4_TAIR10.1/
- the WGBS run's paired-end reads:
  https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR029/DRR029742/

## What bisulfite data looks like

Bisulfite sequencing (WGBS) and its enzymatic cousin EM-seq read DNA methylation
from short reads. A chemical (sodium bisulfite) or enzymatic (APOBEC) step
converts every unmethylated cytosine to uracil, which reads as T, while a
methylated cytosine still reads as C. Comparing each read to the reference
recovers the methylation: a C→T change means unmethylated, a retained C means
methylated. JBrowse 2 makes that comparison per read at render time.

Plants methylate in three sequence contexts: CpG, CHG, and CHH (H is A, C, or
T). JBrowse restricts the coloring to any one of them, so all three read off the
same pileup. Everything below runs on _Arabidopsis thaliana_ data.

## Producing the BAM

The [reproduce script](#reproduce-it-end-to-end) runs the pipeline from the
TAIR10 reference and one wild-type Col-0 WGBS run
([`DRR029742`](https://www.ebi.ac.uk/ena/browser/view/DRR029742), paired-end 150
bp) through Trim Galore to a sorted BAM.

The aligner is [bwameth](https://github.com/brentp/bwa-meth), which C→T converts
both reads and reference in silico and runs `bwa mem`. It emits an ordinary BAM
carrying the original read sequences, so the C→T signal survives for JBrowse to
read. Bismark's BAMs work the same way.

Trimming and alignment, on any pair of WGBS or EM-seq FASTQs:

<!-- from: scripts/build_arabidopsis_wgbs.sh -->

```bash
trim_galore --paired R1.fastq.gz R2.fastq.gz
# index once per reference: bwameth aligns against a C->T copy of it
bwameth.py index tair10.fa
# no methylation flags anywhere: the BAM keeps the original read sequences,
# and JBrowse makes the comparison at render time
bwameth.py --reference tair10.fa -t 8 R1_val_1.fq.gz R2_val_2.fq.gz \
  | samtools sort -o arabidopsis_wgbs.bam -
samtools index arabidopsis_wgbs.bam
```

`bwameth.py index` writes a C→T converted copy of the reference next to the
original, so the reference directory has to be writable.

### Check the conversion rate

An unconverted cytosine is indistinguishable from a methylated one, so measure
the library's conversion rate first. The chloroplast is unmethylated, which
makes it the control:

<!-- from: scripts/build_arabidopsis_wgbs.sh -->

```bash
MethylDackel extract --CHH -r NC_000932.1 -o conversion \
  tair10.fa arabidopsis_wgbs.bam
```

Column 4 of `conversion_CHH.bedGraph` is the methylated percentage at each
cytosine, which on an unmethylated sequence is the fraction the conversion
missed. Modern libraries convert above 99%. An organism with no plastid uses the
library's spike-in, usually unmethylated lambda or pUC19, added to the reference
as an extra contig. The [reproduce script](#reproduce-it-end-to-end) prints the
rate for this run.

### Aggregate methylation, optionally

[MethylDackel](https://github.com/dpryan79/MethylDackel) calls a per-position
methylation fraction in all three plant contexts, one bedGraph each, which
becomes a bigWig once the header line is dropped and the percentage column kept:

```bash
# CpG is emitted always; --CHG --CHH add the two plant contexts.
# -o fixes the output prefix, which the loop below reads back.
MethylDackel extract --CHG --CHH -o arabidopsis_wgbs \
  tair10.fa arabidopsis_wgbs.bam
samtools faidx tair10.fa
cut -f1,2 tair10.fa.fai > tair10.chrom.sizes  # two columns, not the .fai itself
for ctx in CpG CHG CHH; do
  # tail drops MethylDackel's track line; cut keeps the percentage column
  tail -n +2 arabidopsis_wgbs_${ctx}.bedGraph | cut -f1-4 |
    sort -k1,1 -k2,2n > ${ctx}.bg
  bedGraphToBigWig ${ctx}.bg tair10.chrom.sizes arabidopsis_wgbs_${ctx}.bw
done
```

One `MultiQuantitativeTrack` with a subadapter per context renders them as three
labeled rows, the Aggregate methylation track in the figures below. This is the
mechanism of the
[DNA methylation tutorial's aggregate section](/docs/tutorials/methylation#aggregate-methylation-with-modkit-bedmethyl).

```json addtrack
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

The figures use the TAIR10 assembly, its gene models, and the
`arabidopsis_wgbs.bam` produced above. The CLI indexes and bgzips the reference
itself:

<!-- from: scripts/build_arabidopsis_wgbs.sh -->

```bash
jbrowse add-assembly tair10.fa --name tair10 --load copy
```

The gene models come with the reference
(`datasets download genome accession GCF_000001735.4 --include gff3`):

<!-- from: scripts/build_arabidopsis_wgbs.sh -->

```bash
jbrowse sort-gff genomic.gff | bgzip > tair10.gff.gz
tabix -p gff tair10.gff.gz
jbrowse add-track tair10.gff.gz --name "TAIR10 genes" --load copy
```

The alignments track's `displayDefaults` decides which context it opens on, and
the track menu switches it afterwards:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "arabidopsis_wgbs",
  "name": "Arabidopsis WGBS (bwameth)",
  "assemblyNames": ["tair10"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "arabidopsis_wgbs.bam"
  },
  "displayDefaults": {
    "colorBy": {
      "type": "bisulfite",
      "modifications": { "cytosineContext": "CG" }
    }
  }
}
```

[`cytosineContext`](/docs/config/linearalignmentsdisplay/#slot-colorby) takes
`CG`, `CHG`, `CHH` or `all`. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent assembly JSON.

[JBrowse Desktop](/docs/quickstart_desktop) opens `tair10.fa`, the BAM and the
bigWigs straight from local disk.

## Color the reads

In the alignments track menu, pick **Color by... → Bisulfite / EM-seq**, then a
cytosine context: **CpG**, **CHG**, **CHH**, or **All cytosines**. Methylated
cytosines paint red. Once a context is set, the same submenu carries **Show
unmethylated (blue)**, which paints converted sites blue to separate an
unmethylated cytosine from a position with no cytosine. The figure and clip
below leave it off.

## Two methylation regimes

Plants run two unrelated methylation programs, and the three contexts tell them
apart:

| Program                         | CpG | CHG | CHH | Effect on the locus                                                                             |
| ------------------------------- | --- | --- | --- | ----------------------------------------------------------------------------------------------- |
| Gene body methylation (gbM)     | yes | no  | no  | None obvious, the gene stays transcribed. Maintained by MET1, depleted at both ends of the gene |
| Transposon and repeat silencing | yes | yes | yes | Heterochromatin, transcriptionally off. CMT3 maintains CHG, RdDM and CMT2 maintain CHH          |

So red in the CpG row alone is gene body methylation, and red in all three rows
is silencing.

Type `NC_003070.9:4,398,000-4,412,000` into the location box for a window on
chromosome 1 carrying one of each: the expressed gene AT1G12930 on the left, and
a transposon on the right. The [reproduce script](#reproduce-it-end-to-end)
prints the fraction per context for both regions.

The RepeatMasker lane names the element: `META1_LTR#LTR/Copia`, an LTR
retrotransposon, `AT1TE14315` in TAIR10's own transposable-element annotation.
The gene track carries a pseudogene, `AT1G12935`, over the same interval. The
lane comes from UCSC's GenArk hub for TAIR10, whose sequence names are the
RefSeq accessions this assembly uses, so it loads with no aliasing.

<Figure caption="TAIR10 genes, the RepeatMasker lane, the aggregate MethylDackel track, and three copies of the same WGBS pileup colored by CpG, CHG and CHH. AT1G12930 is red in CpG only; the LTR/Copia element on the right is red in all three." src="/img/methylation/arabidopsis_wgbs_contexts.png" />

<Video src="/media/epigenomics/bisulfite_contexts.mp4" caption="One WGBS pileup recolored CpG, then CHG, then CHH from the track menu, under the TAIR10 genes, the RepeatMasker lane and the aggregate MethylDackel rows: red holds over the LTR element through all three contexts and drains from the gene body." />

## Reproduce it end to end

The whole pipeline is wrapped in one script,
[`build_arabidopsis_wgbs.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_arabidopsis_wgbs.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_arabidopsis_wgbs.sh
bash build_arabidopsis_wgbs.sh          # builds ./arabidopsis_wgbs_build/jbrowse2
npx --yes serve arabidopsis_wgbs_build/jbrowse2 # then open the printed URL
```

It downloads the TAIR10 reference and the DRR029742 WGBS run, trims and aligns
them with bwameth, downloads JBrowse, and writes a `config.json` with the
assembly, the gene models, and the pileup pre-colored Bisulfite / CpG, opening
on the window above. With MethylDackel on `PATH` it also prints the conversion
rate and the per-context fractions; the aggregate bigWig track is left out
either way.

On Debian/Ubuntu, `apt install wget samtools tabix` covers several
[prerequisites](#prerequisites). bwameth, Trim Galore and the NCBI `datasets`
CLI install from their own instructions, and `node` from
[nodejs.org](https://nodejs.org/). The alignment step downloads a full WGBS run,
so allow time and disk.

## See also

- [](/docs/tutorials/methylation)
- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/alignments_track)
