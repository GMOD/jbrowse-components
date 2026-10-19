---
title: 'Structural variants (Cancer GIAB) part 2: copy number'
sidebar_label: SVs (Cancer GIAB pt 2, copy number)
description:
  Load four published copy-number callsets and a depth and B-allele frequency
  track for a hypodiploid tumor, and check copy number at four driver genes
guide_category: Tutorials
tutorial_category: Cancer genomics
---

HG008-T, the tumor of the C-GIAB matched pair, is hypodiploid: 35 chromosomes
down from 46, with widespread arm-level loss
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). C-GIAB
publishes copy-number calls on it from four groups. Starting from the assembly,
reads and benchmark that [part 1](/docs/tutorials/sv_visualization_cgiab) loads,
we:

- load four copy-number callsets as tracks: DRAGEN's segments, NYGC's segments
  and log2 ratio, Wakhan's copy number per haplotype, and the benchmark's
  absolute copy number
- build binned depth from the reads with HiFiCNV and B-allele frequency with
  bcftools, and load both beside the callsets
- load tumor and matched-normal coverage as overlapping scatter tracks
- check copy number at four driver genes, _CDKN2A_, _TP53_, _SMAD4_ and _KRAS_,
  against depth and B-allele frequency

## Prerequisites

The walkthroughs also run on the hosted
[C-GIAB demo](https://jbrowse.org/code/jb2/latest/?config=https://jbrowse.org/demos/cgiab/config.json).
Building your own instance needs:

- The JBrowse instance, assembly, CRAMs and benchmark tracks that
  [part 1](/docs/tutorials/sv_visualization_cgiab) builds
- The command-line tools below, with the versions tested in parentheses:
  - [megadepth](https://github.com/ChristopherWilks/megadepth) (v1.2.0 or
    later), for the coverage tracks
  - [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (v1.0 or later),
    for the binned depth track
  - [bcftools](http://www.htslib.org/) (v1.21 or later), for the B-allele
    frequency track
  - [tabix](http://www.htslib.org/doc/tabix.html) (v1.21 or later), to index the
    heterozygous sites
  - `bedGraphToBigWig` from the
    [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)

<!-- TUTORIAL_INSTALL bcftools,htslib,bedGraphToBigWig,megadepth,hificnv START -->

```bash
# Debian/Ubuntu
sudo apt install bcftools tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge bcftools htslib \
  ucsc-bedgraphtobigwig megadepth hificnv
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bedGraphToBigWig
chmod +x ~/.local/bin/bedGraphToBigWig
```

<!-- TUTORIAL_INSTALL bcftools,htslib,bedGraphToBigWig,megadepth,hificnv END -->

## The data

The copy-number call sets are on the C-GIAB FTP, and the tracks over them read
the files by URL. The depth, B-allele frequency and coverage tracks read local
files that the commands below write from the CRAMs of part 1, so run
[the build script](/docs/tutorials/sv_visualization_cgiab#reproduce-it-end-to-end)
first, or follow the same commands on your own reads.

| What it is                                                                       | File                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The V0.5 draft benchmark SV and CNV calls                                        | [NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/)                    |
| DRAGEN's somatic SV and CNV calls (Illumina)                                     | [standard/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/)                                                                                          |
| NYGC's somatic SVs, annotated CNV segments and BIC-seq2 log2 ratio (Illumina)    | [GRCh38-GIABv3/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/)                                                                                 |
| Wakhan's haplotype-specific copy number and LOH segments (HiFi phased with Hi-C) | [bed_output/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi-HiC_Wakhan-CNA_20240424/bed_output/)                                                                                     |
| The earlier Wakhan run's Clair3 tumor small-variant calls                        | [merge_output_tumor.vcf.gz](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Wakhan-CNA_20240308/vcf_inputs/merge_output_tumor.vcf.gz)                                                  |
| The normal's germline calls                                                      | [HG008-N-P.GRCh38.deepvariant.phased.vcf.gz](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/PacBio_Revio_20240125/pacbio-wgs-wdl_germline_20240206/HG008-N-P.GRCh38.deepvariant.phased.vcf.gz) |

## Installing megadepth and HiFiCNV

Two prerequisites install from release binaries:

```bash
wget https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
chmod +x megadepth && sudo mv megadepth /usr/local/bin/
# --strip-components=1: drop the top-level folder of the release tarball
# --wildcards '*/hificnv': extract the binary alone
curl -L https://github.com/PacificBiosciences/HiFiCNV/releases/download/v1.0.1/hificnv-v1.0.1-x86_64-unknown-linux-gnu.tar.gz \
  | tar xz --strip-components=1 -C /usr/local/bin --wildcards '*/hificnv'
```

## Coverage bigWigs from the CRAMs

megadepth writes each CRAM's per-base coverage as a bigWig, which the
driver-gene tracks below read:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
megadepth HG008-T.cram --bigwig
```

## Copy number from the published callsets

C-GIAB publishes copy-number calls on this pair from four groups:

| Callset                                                                                                                                  | Called from                           | Each segment has                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| NIST V0.5 draft benchmark                                                                                                                | assembly comparison plus read support | absolute total and per-haplotype copy number                                                     |
| [Wakhan](https://github.com/KolmogorovLab/Wakhan)                                                                                        | PacBio HiFi, phased with Hi-C         | copy number per parental haplotype, with loss-of-heterozygosity (LOH) intervals in a second file |
| NYGC somatic pipeline, [BIC-seq2](https://doi.org/10.1073/pnas.1110574108)                                                               | Illumina WGS                          | log2 tumor-versus-normal copy ratio, and the genes the segment covers                            |
| [DRAGEN](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/) | Illumina WGS                          | integer copy number, minor-haplotype copy number and minor allele frequency                      |

Read the other callsets against the benchmark CNV BED that
[part 1](/docs/tutorials/sv_visualization_cgiab#the-benchmark-sv-and-cnv-calls)
adds, whose copy numbers are absolute, so CN 2 marks a diploid region.

### Loading DRAGEN copy-number segments

DRAGEN's CNV calls load as an indexed VCF, one record per segment. Record IDs
read `DRAGEN:CNLOH:chr9:22631070-22939213` (copy-neutral loss of
heterozygosity), so the label takes the class from the second field:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hg008t_dragen_cnv",
  "name": "HG008-T DRAGEN somatic CNV (Illumina)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz"
  },
  "displayDefaults": {
    "labels": { "name": "jexl:split(feature.name,':')[1]" }
  }
}
```

### NYGC copy-number segments and log2 copy ratio

C-GIAB publishes the NYGC CNV output in two forms.
`HG008-T--HG008-N.cnv.annotated.v7.final.bed` loads as is, because the adapter
reads column names from its `#` header line.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg008t_nygc_cnv",
  "name": "HG008-T NYGC CNV calls, annotated (BIC-seq2)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/HG008-T--HG008-N.cnv.annotated.v7.final.bed"
  },
  "displayDefaults": {
    "displayMode": "compact",
    "color": {
      "field": "type",
      "domain": ["DEL", "DUP"],
      "range": ["#2166ac", "#b2182b"],
      "labels": ["Loss (DEL)", "Gain (DUP)"],
      "title": "Call"
    },
    "labels": { "name": "jexl:feature.type+' '+feature.cytoband" }
  }
}
```

`HG008-T--HG008-N.bicseq2.txt` is the same segmentation with one log2 ratio per
segment, which one `awk` command converts to a bedGraph:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# column 9 is log2.copyRatio; $2-1 converts the 1-based start to 0-based
awk 'NR>1 {printf "%s\t%d\t%d\t%.4f\n", $1, $2-1, $3, $9}' \
  HG008-T--HG008-N.bicseq2.txt > HG008-T_bicseq2_log2ratio.bedgraph
```

We'll plot it as bars from zero on a fixed axis, so a step means the same thing
from one window to the next. A homozygous deletion has no reads and so no finite
ratio, and a balanced region sits above zero because BIC-seq2 normalizes on
total read counts and HG008-T is hypodiploid.

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "hg008t_bicseq2",
  "name": "HG008-T copy ratio, segmented (NYGC BIC-seq2, log2 T/N)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedGraphAdapter",
    "uri": "HG008-T_bicseq2_log2ratio.bedgraph"
  },
  "displayDefaults": {
    "mark": "bar",
    "scales": {
      "y": {
        "domainMin": -2,
        "domainMax": 2,
        "grid": true,
        "title": "log2 tumor/normal"
      }
    }
  }
}
```

### Loading Wakhan copy number per haplotype

Wakhan's `HG008_HiFi_HiC_copynumbers_segments.bed` is long format, one row per
haplotype, with no `#` on its column-name line:

```text
chr	start	end	copynumber_state	coverage	haplotype
chr1	0	23750000	2	106.025	1
chr1	23750001	119650000	0.72	58.025	1
```

The `haplotype` column assigns each segment to a row, so we use
[`LinearMultiRowFeatureDisplay`](/docs/config/linearmultirowfeaturedisplay) and
set [`rows`](/docs/config/linearmultirowfeaturedisplay/#slot-rows) to
`haplotype`. The adapter names its columns with
[`columnNames`](/docs/config/bedadapter/#slot-columnnames):

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg008t_wakhan_hifi_hic",
  "name": "HG008-T Wakhan copy number per haplotype (HiFi + Hi-C)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi-HiC_Wakhan-CNA_20240424/bed_output/HG008_HiFi_HiC_copynumbers_segments.bed",
    "columnNames": [
      "chrom",
      "start",
      "end",
      "copynumber_state",
      "coverage",
      "haplotype"
    ]
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": "haplotype",
      "color": {
        "field": "copynumber_state",
        "scale": "threshold",
        "domain": [0.5, 1.5],
        "range": ["#2166ac", "#bdbdbd", "#f4a582"],
        "labels": ["Haplotype lost (0)", "One copy", "Two or more copies"],
        "title": "Copy number per haplotype"
      }
    }
  ]
}
```

A `copynumber_state` of `0` marks a haplotype lost across an arm (LOH), and `1`
is the normal single copy. **Advanced → Edit plot...** in the track menu shows
`rows` and `color` as text and applies edits to the open track.

### Building depth-per-bin and B-allele frequency tracks

[HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) writes a binned depth
track from the tumor reads:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# the depth output is <prefix>.<sample>.depth.bw, named for the --bam sample,
#   so this run writes hificnv.<sample>.depth.bw
# the hosted demo renames it HG008-T.hificnv.depth.bw, the uri below
# --maf: the Clair3 tumor small-variant VCF from the C-GIAB Wakhan run;
#   HiFiCNV reads AD from it for the allele-frequency output
# --bam: the reads, for depth
hificnv --bam HG008-T.cram --ref GRCh38.fa --maf tumor_smallvariants.vcf.gz \
  --output-prefix hificnv
```

We'll load the depth as points, the **Scatter** plot type:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "hg008_depth",
  "name": "HG008-T HiFiCNV depth",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "HG008-T.hificnv.depth.bw"
  },
  "displayDefaults": { "mark": "point", "size": 1 }
}
```

To compare the depth with the callsets, draw it with **Plot type → XY plot** and
a fixed axis from **Y axis... → Range**, so a halving reads as a level. Open
`chr9:21,850,000-23,050,000`, around _CDKN2A_, with the depth above the four CNV
callsets:

<Figure caption="Four published CNV callsets over chr9p21.3, under the HiFiCNV depth." src="/img/sv_cgiab/cnv_callset_comparison.png" />

**B-allele frequency** (BAF) is the fraction of tumor reads with the alternate
allele, drawn unfolded. A balanced region is one band at 0.5, and a region with
LOH (one parental copy gone) splits into two bands at 0 and 1. Build it by
piling up the tumor reads at the sites the **normal** calls heterozygous and
taking the alt fraction:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# het sites come from the normal, because LOH sites are homozygous in the tumor
bcftools view -g het -Oz -o hets.vcf.gz normal.deepvariant.vcf.gz
tabix -p vcf hets.vcf.gz
cut -f1,2 GRCh38.fa.fai > GRCh38.chrom.sizes

# -q 1 drops multi-mapped reads, -Q 0 leaves HiFi base qualities alone
bcftools mpileup -f GRCh38.fa -T hets.vcf.gz -a AD -q 1 -Q 0 tumor.bam |
  bcftools query -f '%CHROM\t%POS\t[%AD]\n' |
  # unfolded alt fraction at sites with depth 10 or more
  awk -F'[\t,]' '{d=$3+$4; if (d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' |
  LC_COLLATE=C sort -k1,1 -k2,2n > baf.bedgraph
bedGraphToBigWig baf.bedgraph GRCh38.chrom.sizes HG008-T_baf.bcftools.bw
```

Plot it with **Scatter** over a fixed 0 to 1 range.

<Figure caption="Chromosome 3: the segmented copy ratio, the HiFiCNV depth and B-allele frequency over the benchmark CNV calls." src="/img/sv_cgiab/cnv_depth_baf.png" />

#### Drawing individual BAF points when zoomed out

Zoomed out, the default bigWig summary paints an LOH arm as a solid block of
full height. A small
[`resolutionMultiplier`](/docs/config/bigwigadapter/#slot-resolutionmultiplier)
makes the adapter fetch raw per-site values at the zoom levels of these figures:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "HG008-T_baf",
  "name": "HG008-T B-allele frequency (BAF)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "HG008-T_baf.bcftools.bw",
    "resolutionMultiplier": 0.001
  },
  "displayDefaults": {
    "mark": "point",
    "size": 1,
    "scales": { "y": { "domainMin": 0, "domainMax": 1 } }
  }
}
```

## Checking copy number at four pancreatic cancer driver genes

In pancreatic ductal adenocarcinoma the recurrently altered genes are _KRAS_,
_CDKN2A_, _TP53_ and _SMAD4_
([Waddell et al. 2015](https://doi.org/10.1038/nature14169),
[Bailey et al. 2016](https://doi.org/10.1038/nature16965)). Each copy-number
figure below draws the gene's MANE Select (standard reference) transcript under
the tracks.

For a first check, load the tumor and normal coverage from
[goleft indexcov](https://github.com/brentp/goleft/tree/master/indexcov) as one
multi-wiggle track, one bigWig per sample. indexcov scales each sample by its
median depth, so the two compare directly. It writes a per-sample table, so the
track below reads the demo's bigWig copies; swap each `uri` for your sample's
bigWig:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "hg008_cnv_indexcov",
  "name": "HG008 normal vs tumor coverage (indexcov)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "name": "HG008-N (normal)",
        "type": "BigWigAdapter",
        "bigWigLocation": {
          "uri": "https://jbrowse.org/demos/cgiab/HG008-N_indexcov.bw"
        }
      },
      {
        "name": "HG008-T (tumor)",
        "type": "BigWigAdapter",
        "bigWigLocation": {
          "uri": "https://jbrowse.org/demos/cgiab/HG008-T_indexcov.bw"
        }
      }
    ]
  }
}
```

**Plot type → Overlapping → Scatter** in its track menu draws the two samples as
points in one band, with a key naming each sample's color. **Y axis... → Range**
with 0 and 3 stops indexcov's centromere spikes from flattening every plateau.

Zoom to a region and open the benchmark CNV BED. Coverage shows where the copy
number steps and BAF the allelic balance across each step.

<Video src="/media/sv_cgiab/copy_number_layout.mp4" caption="Plot type → Overlapping → Scatter on the coverage track, drawing the two rows as one band of points." />

<Figure caption="Chromosome 5: the segmented copy ratio, tumor and normal coverage as overlapping scatter, the BAF and the benchmark CNV calls." src="/img/sv_cgiab/cnv_with_bed_track.png" />

### CDKN2A: homozygous deletion

Navigate to `CDKN2A` on chr9. The benchmark calls a focal ~20 kb homozygous
deletion over the gene (`SV_75`, CN 0, no copies left), inside a larger
single-copy-loss arm (`CNA_14`, 0+1 copies on the two haplotypes) where depth is
already halved
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

Load the tumor and matched normal per-base coverage as one
[multi-quantitative track](/docs/user_guides/quantitative_track), one row per
sample, with an explicit score range. The two bigWigs are the `megadepth`
outputs for each sample's CRAM; swap in yours:

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "hg008_tn_perbase",
  "name": "HG008 tumor vs matched normal coverage (per-base)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "name": "HG008-T (tumor)",
        "type": "BigWigAdapter",
        "color": "#e41a1c",
        "bigWigLocation": { "uri": "HG008-T.cram.all.bw" }
      },
      {
        "name": "HG008-N (normal)",
        "type": "BigWigAdapter",
        "color": "#377eb8",
        "bigWigLocation": { "uri": "HG008-N.cram.all.bw" }
      }
    ]
  },
  "displayDefaults": {
    "mark": "bar",
    "extent": "none",
    "scales": { "y": { "domainMin": 0, "domainMax": 80, "grid": false } },
    "height": 280
  }
}
```

Thin lines across the gap in the read pileup are reads with the deletion.

The benchmark's `total_copy_number` is absolute, so CN 2 is diploid; 9p has
already lost a copy, so CN 1 is the local background here. Widen the view
several hundred kilobases right to read CN 2 against it.

<Figure caption="Tumor and normal coverage, the pileup and the CNV calls over CDKN2A." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

### Chromosome 17: two kinds of loss of heterozygosity

Chromosome 17 has two LOH states, split partway along the q-arm. Open it whole
with the depth track above the BAF:

- **The p-arm (covering _TP53_) and the start of the q-arm** are a single-copy
  loss with LOH (`CNA_20`, CN 1, 1+0).
- **The rest of the q-arm** is copy-neutral LOH (`CNA_21`, CN 2, 2+0): one
  haplotype lost, the other duplicated.

<Figure caption="Chromosome 17: the segmented copy ratio, the HiFiCNV depth, the BAF and the benchmark CNV calls." src="/img/sv_cgiab/cnv_chr17_loh.png" />

Together, depth and BAF separate four states:

| depth       | BAF             | Interpretation            |
| ----------- | --------------- | ------------------------- |
| flat (CN 2) | one band at 0.5 | balanced diploid          |
| flat (CN 2) | split to 0, 1   | copy-neutral LOH          |
| halved      | split to 0, 1   | single-copy loss with LOH |
| raised      | 1/3 and 2/3     | allelic gain              |

The benchmark BED's `hap1_copy_number` and `hap2_copy_number` columns give the
`1+0` and `2+0` splits. Click a CNV feature to see both.

### KRAS gain and SMAD4 loss

Navigate to _KRAS_ on chr12. It sits in a gain (`SV_101`, CN 3, 2+1): a 2 Mb
tandem duplication that includes the G12V-mutated copy
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

<Figure caption="KRAS's MANE Select transcript over the copy ratio, depth and BAF, above the CNV calls." src="/img/sv_cgiab/driver_kras_gain.png" />

_SMAD4_ on 18q is a single-copy loss with LOH (`CNA_48`, CN 1, 0+1), like
_TP53_. The balanced p-arm and the matched normal are the two controls. Leave
the copy-ratio track's `color` unset (one color above the `origin` of 0, another
below) with a symmetric axis, so a step down and a step up fill equally.

<Figure caption="SMAD4's MANE Select transcript over the copy ratio, tumor and normal coverage and the BAF, above the CNV calls." src="/img/sv_cgiab/driver_smad4_loh.png" />

## Reproduce it end to end

[`build_sv_visualization_cgiab.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_sv_visualization_cgiab.sh)
writes the coverage, depth and B-allele frequency files above as part of the run
that [part 1](/docs/tutorials/sv_visualization_cgiab#reproduce-it-end-to-end)
describes.

## See also

- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/population_cnv)
- [](/docs/user_guides/quantitative_track)

## Citations

- Bailey et al. (2016).
  [Genomic analyses identify molecular subtypes of pancreatic cancer](https://doi.org/10.1038/nature16965)
- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
- McDaniel et al. (2025).
  [Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-05438-2)
- Waddell et al. (2015).
  [Whole genomes redefine the mutational landscape of pancreatic cancer](https://doi.org/10.1038/nature14169)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)
