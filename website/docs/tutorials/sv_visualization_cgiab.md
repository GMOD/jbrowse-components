---
title: Structural variants (Cancer GIAB)
sidebar_label: SVs (Cancer GIAB)
description:
  Build a tumor/normal HiFi site from raw reads, and read its benchmark SV and
  CNV calls against the alignments that support them
guide_category: Tutorials
tutorial_category: Cancer genomics
---

The Cancer Genome in a Bottle project publishes HG008, a matched tumor/normal
PDAC cell line, as PacBio HiFi reads, a draft SV and CNV benchmark, and a
telomere-to-telomere assembly of the tumor. We load them as JBrowse tracks and
read each benchmark call against the alignments and the copy number under it.
We:

- load the benchmark SV and CNV calls beside four further published callsets
- read one chr3-chr13 translocation three ways: the caller's breakend, the reads
  that span it, and the tumor assembly that resolves it onto one contig
- check copy number at four driver genes, _CDKN2A_, _TP53_, _SMAD4_ and _KRAS_,
  against depth and B-allele frequency
- align the tumor assembly to GRCh38 and view the same rearrangement as synteny
  and a dotplot

## Prerequisites

The walkthroughs at the end run on the hosted
[C-GIAB demo](https://jbrowse.org/code/jb2/latest/?config=https://jbrowse.org/demos/cgiab/config.json)
with none of this. Building your own instance needs:

- A machine with HTTP access, either a public URL or `http://localhost`
- ~1 TB of free disk for the tracks, or ~1.5 TB for the
  [full pipeline](#reproduce-it-end-to-end)
- At least 32 GB of RAM for the minimap2 step; only data preparation needs it.
- The command-line tools below, with the versions tested in parentheses:
  - [JBrowse CLI](/docs/cli) (`@jbrowse/cli` v3.6.5 or later)
  - [Node.js](https://nodejs.org/) (v18 minimum, v24.1.0 used for this tutorial)
  - [tabix](http://www.htslib.org/doc/tabix.html) (v1.21 or later)
  - [samtools](http://www.htslib.org/) (v1.21 or later)
  - [minimap2](https://github.com/lh3/minimap2)
  - [megadepth](https://github.com/ChristopherWilks/megadepth) (v1.2.0 or
    later), for the coverage tracks
  - [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (v1.0 or later),
    for the binned depth track

## Where the data comes from

HG008, the C-GIAB matched tumor/normal pair, under NCBI BioProject PRJNA200694
on the C-GIAB FTP. The assemblies are on NIST's S3 bucket, and the per-clone CNV
calls are rehosted here.

The reference and the reads:

- the C-GIAB reference build (GRCh38 with decoys and masked regions):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/release/references/GRCh38/GRCh38_GIABv3_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz
- the tumor/normal PacBio HiFi reads (Revio run, 116x tumor, 35x normal):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/

The somatic call sets, one per group that published one:

- the V0.5 draft benchmark SV and CNV calls:
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/
- Severus somatic SVs (HiFi):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Severus-SV_20240308/somatic_SVs/severus_somatic.vcf.gz
- the minda ensemble SVs (HiFi, ONT and Illumina callers):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH-NCI_minda-ensemble_20240710/HG008_minda_ensemble.vcf
- DRAGEN's somatic SV and CNV calls (Illumina):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/
- NYGC's somatic SVs, annotated CNV segments and BIC-seq2 log2 ratio (Illumina):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/
- Wakhan's haplotype-specific copy number and LOH segments (HiFi phased with
  Hi-C):
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi-HiC_Wakhan-CNA_20240424/bed_output/
- the earlier Wakhan run's Clair3 tumor small-variant calls:
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Wakhan-CNA_20240308/vcf_inputs/merge_output_tumor.vcf.gz
- the normal's germline calls:
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/PacBio_Revio_20240125/pacbio-wgs-wdl_germline_20240206/HG008-N-P.GRCh38.deepvariant.phased.vcf.gz

The assemblies:

- the T2T tumor assembly, v3.2:
  https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/HG008T_v3.2/HG008T_v3.2.fasta.gz
- the matched normal assembly, v6.3:
  https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/HG008N_v6.3/HG008N_v6.3.fasta.gz

The single-cell-derived clone panel:

- short-read WGS, one run per clone:
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/NIST/HG008-T_clones/
- the per-clone CNVkit calls, rehosted merged into one multi-row BED:
  https://jbrowse.org/demos/cgiab/HG008T-clones.cnv.multirow.bed.gz

## The C-GIAB dataset

[C-GIAB](https://www.nist.gov/programs-projects/cancer-genome-bottle) publishes
HG008 from one pancreatic ductal adenocarcinoma (PDAC) donor, as the tumor
(HG008-T) and normal pancreatic tissue (HG008-N-P). HG008-T is **hypodiploid**,
with 35 tumor chromosomes down from 46, widespread arm-level loss, and truncal
interchromosomal rearrangements
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

## Setting up

The instance itself is the [web quickstart](/docs/quickstart_web) unchanged. Two
of the prerequisites install from release binaries:

```bash
wget https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
chmod +x megadepth && sudo mv megadepth /usr/local/bin/
# --strip-components drops the release's top-level folder and --wildcards
# extracts only the binary, straight into the install directory
curl -L https://github.com/PacificBiosciences/HiFiCNV/releases/download/v1.0.1/hificnv-v1.0.1-x86_64-unknown-linux-gnu.tar.gz \
  | tar xz --strip-components=1 -C /usr/local/bin --wildcards '*/hificnv'
```

[Reproduce it end to end](#reproduce-it-end-to-end) builds this instance in one
script; the sections below give the track config for each file.

## The benchmark SV and CNV calls

The V0.5 HG008-T draft benchmark is two files, the SV calls as an indexed VCF
and the CNV calls as a BED, both loaded straight from their FTP URL.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hg008t_benchmark_sv",
  "name": "HG008-T V0.5 draft benchmark somatic SVs",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz"
  }
}
```

The CNV BED ships without a header; name its columns with
[`columnNames`](/docs/config/bedadapter/#slot-columnnames):

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg008t_somatic_cnv",
  "name": "HG008-T somatic CNV",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/GRCh38_HG008-T-V0.5_somatic-CNV_PASS.draftbenchmark.calls.bed",
    "columnNames": [
      "chrom",
      "start",
      "end",
      "total_copy_number",
      "hap1_copy_number",
      "hap2_copy_number",
      "name"
    ]
  }
}
```

## The reads and their coverage

The tumor and normal BAMs carry no `MD` tags. Convert each to a local CRAM
against the reference above and write a coverage bigWig beside it:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# -T names the reference the CRAM is written against, and it has to be the same
# build the assembly was loaded from or every base reads as a mismatch
# --write-index saves a second samtools pass for the .crai
samtools view HG008-T.bam --write-index -o HG008-T.cram -T GRCh38.fa

# one whole-genome coverage bigWig per sample, written beside its CRAM
megadepth HG008-T.cram --bigwig
```

## Structural variants from the published callsets

The benchmark is one of five somatic SV callsets C-GIAB publishes for this pair,
each loaded the same way:

| Callset                                                                                                                 | Called from                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| NIST V0.5 draft benchmark                                                                                               | assembly comparison plus read support          |
| [Severus](https://github.com/KolmogorovLab/Severus)                                                                     | PacBio HiFi                                    |
| [minda](https://github.com/KolmogorovLab/minda) ensemble                                                                | eleven caller runs over HiFi, ONT and Illumina |
| DRAGEN                                                                                                                  | Illumina WGS                                   |
| NYGC somatic pipeline ([Manta](https://github.com/Illumina/manta) and [GRIDSS](https://github.com/PapenfussLab/gridss)) | Illumina WGS                                   |

<Figure caption="The chr3 breakends of the benchmark's cluster_3 in five SV callsets, over the HiFiCNV depth and the benchmark's CNV lane. Every callset marks both breakends, the depth steps down between them, and the CNV lane crosses the whole window as one segment." src="/img/sv_cgiab/sv_callset_comparison.png" />

### Severus and DRAGEN

Severus and DRAGEN are both indexed VCFs with a record at each breakend, so they
load with no display settings:

```json addtrack config=https://jbrowse.org/demos/cgiab/config.json loc=chr3:139,970,000-140,005,000
{
  "type": "VariantTrack",
  "trackId": "hg008t_severus_sv",
  "name": "HG008-T Severus somatic SVs (HiFi)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Severus-SV_20240308/somatic_SVs/severus_somatic.vcf.gz"
  }
}
```

```json addtrack config=https://jbrowse.org/demos/cgiab/config.json loc=chr3:139,970,000-140,005,000
{
  "type": "VariantTrack",
  "trackId": "hg008t_dragen_sv",
  "name": "HG008-T DRAGEN somatic SVs (Illumina)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.sv.vcf.gz"
  }
}
```

### minda: the caller runs behind each junction

The ensemble callset is a plain VCF, so [`VcfAdapter`](/docs/config/vcfadapter)
loads it whole, with no index:

```json addtrack config=https://jbrowse.org/demos/cgiab/config.json loc=chr3:139,970,000-140,005,000
{
  "type": "VariantTrack",
  "trackId": "hg008t_minda_sv",
  "name": "HG008-T minda ensemble SVs (HiFi, ONT, Illumina)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "VcfAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH-NCI_minda-ensemble_20240710/HG008_minda_ensemble.vcf"
  }
}
```

### NYGC: a BEDPE drawn as arcs

[`BedpeAdapter`](/docs/config/bedpeadapter) reads a paired-end BED whole, with
no index, and serves it to a variant track:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hg008t_nygc_sv",
  "name": "HG008-T NYGC somatic SVs (Manta, GRIDSS)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedpeAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/HG008-T--HG008-N.sv.annotated.v7.somatic.high_confidence.final.bedpe"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "displayId": "hg008t_nygc_sv-LinearMarkDisplay",
      "marks": [
        {
          "mark": "link",
          "size": 2,
          "transform": [{ "type": "mate" }]
        }
      ]
    }
  ]
}
```

## Copy number from the published callsets

Four groups have called copy number on this pair, and C-GIAB publishes each
one's output:

| Callset                                                                                                                                  | Called from                           | Each segment carries                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| NIST V0.5 draft benchmark                                                                                                                | assembly comparison plus read support | absolute total and per-haplotype copy number                                |
| [Wakhan](https://github.com/KolmogorovLab/Wakhan)                                                                                        | PacBio HiFi, phased with Hi-C         | copy number per parental haplotype, with LOH intervals in a second file     |
| NYGC somatic pipeline, [BIC-seq2](https://doi.org/10.1073/pnas.1110574108)                                                               | Illumina WGS                          | log2 tumor-versus-normal copy ratio, and the genes the segment covers       |
| [DRAGEN](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/) | Illumina WGS                          | integer copy number, minor-haplotype copy number and minor allele frequency |

The benchmark CNV BED added above is the lane the others get read against: its
copy numbers are absolute, and CN 2 states a diploid region explicitly. Depth
per bin is the one signal no group publishes, and the end of this section builds
it from the tumor reads.

<Figure caption="Four published CNV callsets over chr9p21.3, with the HiFiCNV depth above them. Depth drops out over CDKN2A, where the benchmark and NYGC both carry a focal call and the two coarser segmentations run straight through." src="/img/sv_cgiab/cnv_callset_comparison.png" />

### DRAGEN: integer copy number from short reads

DRAGEN's CNV calls load as an indexed VCF, one record per segment:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hg008t_dragen_cnv",
  "name": "HG008-T DRAGEN somatic CNV (Illumina)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz"
  }
}
```

### NYGC: a copy ratio, and the genes each segment covers

C-GIAB publishes NYGC's CNV output two ways.
`HG008-T--HG008-N.cnv.annotated.v7.final.bed` needs nothing done to it; its `#`
header line lets the adapter read column names straight from the file.

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
  "displays": [{ "type": "LinearBasicDisplay", "displayMode": "compact" }],
  "displayDefaults": {
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

`HG008-T--HG008-N.bicseq2.txt` is the same segmentation in quantitative form,
one log2 ratio per segment, and one `awk` away from a bedGraph:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# column 9 is log2.copyRatio, and the file is 1-based where bedGraph is not
awk 'NR>1 {printf "%s\t%d\t%d\t%.4f\n", $1, $2-1, $3, $9}' \
  HG008-T--HG008-N.bicseq2.txt > HG008-T_bicseq2_log2ratio.bedgraph
```

Plot it as a **Line (step)** over a fixed range. A homozygous deletion has no
reads and so no finite ratio, and the balanced baseline sits above zero.

### Wakhan: copy number per parental haplotype

`HG008_HiFi_HiC_copynumbers_segments.bed` is long format, one row per haplotype,
with no `#` on its column-name line:

```text
chr	start	end	copynumber_state	coverage	haplotype
chr1	0	23750000	2	106.025	1
chr1	23750001	119650000	0.72	58.025	1
```

Name the columns on the adapter with
[`columnNames`](/docs/config/bedadapter/#slot-columnnames). Because the
haplotype column already assigns each segment to a row, use
[`LinearMultiRowFeatureDisplay`](/docs/config/linearmultirowfeaturedisplay) and
set [`rows`](/docs/config/linearmultirowfeaturedisplay/#slot-rows) to
`haplotype`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg008_wakhan_haplotype",
  "name": "HG008-T Wakhan copy number per haplotype",
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
      "displayId": "hg008_wakhan_haplotype-LinearMultiRowFeatureDisplay",
      "rows": "haplotype",
      "color": {
        "field": "copynumber_state",
        "scale": "threshold",
        "domain": ["0.5", "1.5"],
        "range": ["#2166ac", "#bdbdbd", "#f4a582"],
        "labels": ["Haplotype lost (0)", "One copy", "Two or more copies"],
        "title": "Copy number per haplotype"
      }
    }
  ]
}
```

`copynumber_state` of `0` is a lost haplotype behind an arm LOH; `1` is
expected.

### Depth per bin, and B-allele frequency

[HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) writes a binned depth
track from the tumor reads:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# --maf holds the TUMOR's small-variant calls, the Clair3 tumor VCF published
# alongside C-GIAB's Wakhan run: HiFiCNV reads AD out of this VCF for its
# allele-frequency output; --bam supplies depth only
hificnv --bam HG008-T.cram --ref GRCh38.fa --maf tumor_smallvariants.vcf.gz \
  --output-prefix hificnv
```

HiFiCNV names its depth output for the `--bam` sample. Give it the **Scatter**
plot type.

The allelic panel is **B-allele frequency**, unfolded: a balanced region is one
band at 0.5, a loss-of-heterozygosity region splits into two bands at 0 and 1.
Build it by piling up the tumor reads at the sites the **normal** calls
heterozygous and taking the alt fraction:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# het sites from the NORMAL: an LOH site is homozygous in the tumor, so a
# tumor-derived list would drop exactly the sites this track needs to show
bcftools view -g het -Oz -o hets.vcf.gz normal.deepvariant.vcf.gz
tabix -p vcf hets.vcf.gz
cut -f1,2 GRCh38.fa.fai > GRCh38.chrom.sizes

# -q 1 drops multi-mapped reads, -Q 0 leaves HiFi base qualities alone
bcftools mpileup -f GRCh38.fa -T hets.vcf.gz -a AD -q 1 -Q 0 tumor.bam |
  bcftools query -f '%CHROM\t%POS\t[%AD]\n' |
  # unfolded alt fraction, so LOH separates into bands at 0 and 1; folding
  # would merge them into one. The 10x floor keeps thin coverage from painting a fake 0/1
  awk -F'[\t,]' '{d=$3+$4; if (d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' |
  LC_COLLATE=C sort -k1,1 -k2,2n > baf.bedgraph
bedGraphToBigWig baf.bedgraph GRCh38.chrom.sizes tumor_baf.bw
```

Plot it with **Scatter** over a fixed 0 to 1 range.

<Figure caption="Chromosome 3 over the benchmark CNV calls: BIC-seq2's segmented log2 copy ratio, the HiFiCNV depth, and B-allele frequency. The p-arm is a single-copy loss with loss-of-heterozygosity; the q-arm is balanced." src="/img/sv_cgiab/cnv_depth_baf.png" />

#### Keep the BAF track off bigWig summaries

A bigWig's default zoomed-out summary paints an LOH arm as a solid full-height
wash. A small
[`resolutionMultiplier`](/docs/config/bigwigadapter/#slot-resolutionmultiplier)
keeps the fetch on raw per-site values at these figures' zoom levels:

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

**Resolution → Finer** in the track menu is the same fix interactively, whenever
a scatter track paints as a filled band.

### Subclonal copy number

HG008-T is a cellular mixture: a genome-doubled fraction grows across passages
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), and the
benchmark CNV BED reports copy number for the cells that have not doubled.

C-GIAB publishes short-read WGS for a panel of HG008-T single-cell-derived
clones under
[`HG008-T_clones/`](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/NIST/HG008-T_clones/).
Merged per clone into one BED with a `clone` column, they partition into rows
like the Wakhan haplotypes; a row that departs from the rest is a CNV private to
that subclone:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg008_subclonal_cnv",
  "name": "HG008-T subclonal CNV (per-clone CNVkit)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/cgiab/HG008T-clones.cnv.multirow.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "hg008_subclonal_cnv-LinearMultiRowFeatureDisplay",
      "rows": "clone",
      "color": {
        "field": "cn",
        "scale": "threshold",
        "domain": ["1", "2", "3", "4"],
        "range": ["#2166ac", "#92c5de", "#e0e0e0", "#f4a582", "#b2182b"],
        "labels": ["CN 0", "CN 1", "CN 2", "CN 3", "CN 4+"],
        "title": "Copy number"
      }
    }
  ]
}
```

Read those integers on the caller's own scale: CNVkit centers each sample's log2
on its own median, so the balanced state here is not CN 2. The benchmark CNV
track anchors them with an absolute `total_copy_number`.

## Align the tumor assembly to GRCh38

The tumor assembly is haplotype-resolved into T2T scaffolds. Load it as a second
JBrowse assembly and align it to GRCh38; the synteny and dotplot views draw from
the resulting PAF:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# asm5 is the same-species preset; -c emits the base-level CIGAR the synteny
# view needs to draw a junction at base scale
minimap2 -cx asm5 GRCh38.fa HG008T_v3.2.fasta > HG008T_v3.2.paf

# -a is query,target, the REVERSE of the target query minimap2 just took: get it
# backwards and the view opens empty with no error
jbrowse add-track HG008T_v3.2.paf -a HG008T_v3.2,GRCh38_GIABv3
```

The matched normal assembly (`HG008N_v6.3.fasta.gz`, same S3 path) loads the
same way. See the
[synteny track config guide](/docs/config_guides/synteny_track).

## Walkthroughs

Each walkthrough runs on an instance built above, or on
[the hosted C-GIAB demo](https://jbrowse.org/code/jb2/latest/?config=https://jbrowse.org/demos/cgiab/config.json),
which already carries the benchmark calls, the reads and the copy-number tracks.

### A chr3-chr13 translocation

**Add → SV inspector**, then **Open from track** to pick the C-GIAB benchmark
VCF loaded earlier.

<Figure caption="The SV inspector showing the benchmark VCF as a circular overview alongside a table of calls." src="/img/sv_cgiab/translocation_sv_inspector_view.png" />

Click the chord joining chr3 and chr13, then open the tumor PacBio HiFi reads on
each panel of the breakpoint split view it launches and set **Read height** →
**Compact**.

<Figure caption="Clicking the chord joining chr3 and chr13 opens a breakpoint split view. Splines connect tumor PacBio HiFi reads that partially map to each chromosome, evidence of a fusion or translocation." src="/img/sv_cgiab/translocation_breakpoint_split.png" />

The next walkthrough reads this one three ways.

### The same junction three ways

`SV_20` and `SV_190` are one junction written twice, joining chr3:139,976,414 to
chr13:114,353,244, filed under `EVENT=cluster_3` with two further breakends and
tagged `EVENTTYPE=CHROMOPLEXY`. Choose `cluster_3` under **Filter by event**,
and open a record in a breakpoint split view for a panel at each locus.

In that view, splines join each tumor PacBio HiFi read's chr13 piece to its chr3
piece: chr13 forward into the junction, then down chr3 inverted. The matched
normal reads through the same locus with no split.

The synteny track loaded earlier shows the same junction with no reads: the
C-GIAB assembly resolves both loci onto one tumor contig, named for the two
chromosomes it fuses.

The hosted demo slices the tumor reads to the loci these walkthroughs visit,
reaching one of `cluster_3`'s junctions.
[The build script](#reproduce-it-end-to-end) lifts that limit.

### Which calls are drivers

In pancreatic ductal adenocarcinoma the recurrently altered genes are _KRAS_,
_CDKN2A_, _TP53_ and _SMAD4_
([Waddell et al. 2015](https://doi.org/10.1038/nature14169),
[Bailey et al. 2016](https://doi.org/10.1038/nature16965)); every copy-number
figure below draws one MANE Select transcript under the lanes.

### A small deletion in CUZD1

Use the **search** (magnifying glass) button in the SV inspector for `SV_85`, a
heterozygous deletion affecting two exons of _CUZD1_
([NCBI Gene 50624](https://www.ncbi.nlm.nih.gov/gene/50624)) that takes one of
its two copies; at ~1.8 kb it reads base by base in a pileup.

**ClinVar CNVs** carries submitted copy-number variants and their clinical
significance, served by UCSC as a bigBed:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg38_clinvar_cnv_ucsc",
  "name": "ClinVar CNVs (UCSC)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarCnv.bb"
  },
  "displays": [{ "type": "LinearBasicDisplay", "displayMode": "compact" }],
  "displayDefaults": {
    "jexlFilters": ["get(feature,'_varLen') < 50000"]
  }
}
```

The size filter keeps the lane at this event's scale. No submitted CNV near this
deletion's size covers this locus.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion, and the linear genome view its location link opens: the <DEL> ALT allele over the ClinVar CNV and NCBI RefSeq gene lanes." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Open the gene annotations and the tumor PacBio HiFi reads, set **Read height →
Compact** and **Sort by... → Base pair** from the track menu, and center the
deletion. The view menu's **center line** helps line up the breakpoint.

<Figure caption="Tumor PacBio HiFi reads at compact height, sorted by base pair with the deletion centered, over the gene annotations. The deletion removes two CUZD1 exons and is heterozygous." src="/img/sv_cgiab/deletion_linear_view.png" />

### A tandem-repeat call, sized against the normal

Some benchmark records, tagged `EVENTTYPE=CNV:TR`, size a somatic change inside
a tandem repeat against the donor's own germline allele, giving `SVLEN` a value
specific to this pair.

`SV_223` on chr5 is the benchmark's own worked example. Open it with both
samples' PacBio HiFi reads and sort each pileup at the call:

<Figure caption="SV_223 at base level: the benchmark's deletion call over the tumor and matched normal PacBio HiFi pileups. The tumor's reads carry a deletion where the normal's carry an insertion at the same repeat, and the called span is wider than the deletion under it." src="/img/sv_cgiab/vntr_tumor_normal.png" />

The record is also given in the normal assembly's coordinates (`CHROM_HG8N6.3`
and its siblings), so clicking it shows the same variant against the normal's
own sequence.

### Reading copy number

The quickest copy-number check is the tumor and normal coverage bigWigs as one
multi-bigwig track:

- **Show all regions in assembly** on the linear genome view start screen opens
  every chromosome at once.
- **Score → Set min/max score...** in the track menu pins the axis off the
  centromere and repeat spikes.
- **Plot type → Overlapping → Scatter** draws the two samples as points in one
  band, tumor red and normal blue.

<Figure caption="The linear genome view start screen, with every chromosome laid out across the view." src="/img/sv_cgiab/cnv_show_all_regions.png" />

The tumor and normal rows come from
[goleft indexcov](https://github.com/brentp/goleft/tree/master/indexcov),
published as `HG008-N_indexcov.bw` and `HG008-T_indexcov.bw`, and load as a
multi-wiggle track by URL.

Zoom to a region and open the benchmark CNV BED against the called intervals:
coverage marks that a level changed, and the BAF track shows what changed.

<Video src="/media/sv_cgiab/copy_number_layout.mp4" caption="Plot type → Overlapping → Scatter on the coverage track over chr5, redrawing the two stacked rows as one band of points: the normal holds flat while the tumor steps." />

<Figure caption="Chromosome 5: the segmented copy ratio, tumor and normal indexcov coverage as overlapping scatter, B-allele frequency, and the benchmark CNV calls. The normal stays flat while the tumor steps, and the BAF lane shows what each step is." src="/img/sv_cgiab/cnv_with_bed_track.png" />

Four loci in HG008-T sit in four different copy-number states, and the depth,
BAF and copy-number lanes built above tell them apart:

| Locus  | State in HG008-T                 | Signature on the tracks             |
| ------ | -------------------------------- | ----------------------------------- |
| CDKN2A | Focal homozygous deletion (CN 0) | depth to 0, copy number 0           |
| TP53   | 17p loss + LOH (CN 1, 1+0)       | depth halved, BAF splits to 0 and 1 |
| SMAD4  | 18q loss + LOH (CN 1, 0+1)       | depth halved, BAF splits to 0 and 1 |
| KRAS   | Tandem duplication (CN 3, 2+1)   | depth raised, BAF to 1/3 and 2/3    |

Arm-level loss is widespread here, so a single band at 0.5 is the exception;
chr17 below is LOH end to end.

#### CDKN2A: a homozygous deletion inside a single-copy loss

Navigate to `CDKN2A` on chr9: the benchmark calls a focal ~20 kb homozygous
deletion over the gene (`SV_75`, CN 0), inside a larger single-copy-loss arm
(`CNA_14`, 0+1) where depth is already halved
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

Load the tumor and matched normal per-base coverage as one
[multi-quantitative track](/docs/user_guides/quantitative_track), one row per
sample, with an explicit score range. Thin lines crossing the read pileup's gap
are single reads carrying the deletion.

The benchmark's `total_copy_number` is absolute: CN 2 is diploid, and 9p has
already lost a copy, so CN 1 is the local background. Widen the view several
hundred kilobases right to read CN 2 against it.

<Figure caption="The CDKN2A deletion at 60 kb: coverage drops out in the tumor row and not in the normal, the read pileup drops out with it, and the CNV call under them reads CN 0." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

#### chr17: loss with LOH, and copy-neutral LOH

Chromosome 17 carries a different LOH state on each arm. Open the whole
chromosome with the depth track above the BAF:

- the p-arm (covering _TP53_) is a single-copy loss with LOH (`CNA_20`, CN 1,
  1+0): depth is halved and the BAF splits away from 0.5.
- the q-arm is copy-neutral LOH (`CNA_21`, CN 2, 2+0): one haplotype lost, the
  other duplicated, so depth stays flat but the BAF still splits away from 0.5.

The copy-ratio lane fills from a zero pivot, above which the q-arm's
copy-neutral state fills upward like a gain. Read the lane by its steps.

<Figure caption="Chromosome 17: the segmented copy ratio, the HiFiCNV depth, the BAF and the benchmark CNV calls. The p-arm is a single-copy loss with LOH; the q-arm is copy-neutral LOH, flat in both copy-number lanes and still split in the BAF." src="/img/sv_cgiab/cnv_chr17_loh.png" />

The depth and BAF combinations read as a compact decision table:

| depth       | BAF             | Interpretation            |
| ----------- | --------------- | ------------------------- |
| flat (CN 2) | one band at 0.5 | balanced diploid          |
| flat (CN 2) | split to 0, 1   | copy-neutral LOH          |
| halved      | split to 0, 1   | single-copy loss with LOH |
| raised      | 1/3 and 2/3     | allelic gain              |

The benchmark BED's `hap1_copy_number`/`hap2_copy_number` columns encode this: a
`0` haplotype (e.g. `1+0`, `2+0`) has lost one parental allele, splitting the
BAF away from 0.5 regardless of total copy number. Clicking a CNV feature shows
both.

#### KRAS and SMAD4

_KRAS_ on chr12 sits in a gain (`SV_101`, CN 3, 2+1), a 2 Mb tandem duplication
carrying the G12V-mutated copy
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), a handful of
pixels wide at whole-chromosome scale.

<Figure caption="KRAS on chr12: its MANE Select transcript over the segmented copy ratio, the HiFiCNV depth and the BAF, above the CNV calls. Over the tandem duplication the copy-ratio edges land on the called boundaries and the BAF separates into two bands." src="/img/sv_cgiab/driver_kras_gain.png" />

_SMAD4_ on 18q is lost with LOH (`CNA_48`, CN 1, 0+1), the mirror image of
_TP53_, with two controls: the balanced p-arm and the matched normal. Leave the
display's bicolor mode on with a symmetric axis, so a step down and a step up
fill equally.

<Figure caption="Chromosome 18: SMAD4's MANE Select transcript over the segmented copy ratio, the tumor and its matched normal from indexcov, and the BAF, above the CNV calls. All three lanes change together from ~30 Mb to the telomere." src="/img/sv_cgiab/driver_smad4_loh.png" />

### Synteny and dotplot views of the tumor assembly

**Add → Dotplot view**, set the de novo assembly as one axis and GRCh38 as the
other, and pick the matching synteny track.

<Figure caption="The dotplot import form, with the HG008-T v3.2 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

HG008-T v3.2's scaffold names end in `_hap1` or `_hap2`, so one plot stacks both
haplotypes and doubles every diagonal. Restrict the y axis to one haplotype at a
time for a plain assembly-vs-reference diagonal.

<Figure caption="The two haplotypes of HG008-T v3.2 (y) against GRCh38 chromosomes (x), hap1 left and hap2 right. Each scaffold is one diagonal segment. On hap1 the chr3_chr13_hap1 scaffold carries a piece of chr3 and a piece of chr13, the translocation; on hap2 chr13_hap2 is one unbroken diagonal against chr13." src="/img/sv_cgiab/dotplot_haplotypes.png" />

Drag over a region and take **Launch → Linear synteny view**, keeping **HG008T
v3.2** as the synteny dataset, then enter `chr3 chr13` in the GRCh38 search box.
Raising the **minimum alignment length** drops short, noisy anchors; zooming
into a breakpoint reads it at base level.

**Add row** in the import form gives each haplotype a separate panel: hap2,
GRCh38, hap1, one level of ribbons per adjacent pair. Three rows keep the fusion
legible, since hap1's ribbons cross where hap2's do not.

<Figure caption="A three-row synteny view of the chr3/chr13 selection: hap2 on top, GRCh38 chr3 and chr13 in the middle, and the fused chr3_chr13_hap1 scaffold below, at a raised minimum alignment length. The two blue bands on the reference row mark the translocation's breakends, chr3:139,976,414 and chr13:114,353,244. The ribbons below the reference cross between them, where hap1 joins the two chromosomes; the ribbons above run to hap2, whose chr13 is unrearranged and whose chr3 material sits in a scaffold fused with chr6 and chr11." src="/img/sv_cgiab/synteny_view.png" />

A scaffold named for two GRCh38 chromosomes is the cue.

For more on these views, see the
[dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

### Methylation on the tumor reads

The C-GIAB PacBio HiFi BAMs carry per-read 5mC calls in their `MM`/`ML` tags,
rendered with no extra files. Open the tumor reads. Set **Color by... →
Modifications**, then **One color per type, plus low-probability & unmodified in
blue**, which paints every CpG in context.

<Figure caption="Tumor PacBio HiFi reads at the CDKN2B-AS1 end of the CDKN2A locus, over the NCBI RefSeq gene lane, colored by base modification with unmodified cytosines filled in. Neighboring CpG-dense blocks come out in opposite states, one of them at the CDKN2B-AS1 transcription start." src="/img/sv_cgiab/methylation_cdkn2b.png" />

Where the marks thin out to scattered ticks, that is CpG density: the fill draws
a cytosine only where the reference puts one in context.

See
[Modifications and methylation](/docs/user_guides/alignments_track#modifications-and-methylation)
for the display modes, and the
[methylation tutorial](/docs/tutorials/methylation) for the aggregate and
allele-specific views.

## Where to go next

Swap the VCF, the CRAMs, the caller output and the assembly for your own; the
same tracks and walkthroughs apply. See the
[SV visualization guide](/docs/user_guides/sv_visualization) for further display
options.

Within C-GIAB itself there is more on the same FTP than this tutorial loads:

- a **somatic small-variant draft benchmark**, which loads as a variant track
  the same way
- the **matched normal assembly** (`HG008N`), which loads as a second JBrowse
  assembly and serves as the synteny target
- **HG009**, a second matched pair (PDAC liver metastasis with matched CD4+ T
  cells) on the
  [NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)

## Reproduce it end to end

[`build_sv_visualization_cgiab.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_sv_visualization_cgiab.sh)
runs the whole data-preparation pipeline above in one shot:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_sv_visualization_cgiab.sh
bash build_sv_visualization_cgiab.sh   # builds ./cgiab_build/jbrowse2
npx --yes serve cgiab_build/jbrowse2
```

The script fetches the C-GIAB GRCh38 build and the V0.5 benchmark calls, then
runs the CRAM, coverage, HiFiCNV, BAF and minimap2 steps above, downloads
JBrowse, and writes a `config.json` with all of it loaded beside the published
Wakhan segments.

The script needs the tools listed under [Prerequisites](#prerequisites), plus
`bcftools` and `bedGraphToBigWig`. It pulls down more than 200 GB, wants roughly
1.5 TB of free disk and 32 GB of RAM, and its alignment and copy-number steps
take hours.

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/cancer_sv)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/quantitative_track)

## References

- Bailey et al. (2016).
  [Genomic analyses identify molecular subtypes of pancreatic cancer](https://doi.org/10.1038/nature16965)
- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
- McDaniel et al. (2025).
  [Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-05438-2)
- Rautiainen et al. (2023).
  [Verkko: telomere-to-telomere assembly of diploid chromosomes](https://doi.org/10.1038/s41587-023-01662-6)
- Waddell et al. (2015).
  [Whole genomes redefine the mutational landscape of pancreatic cancer](https://doi.org/10.1038/nature14169)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)
