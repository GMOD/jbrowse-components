---
title: Structural variants (Cancer GIAB)
sidebar_label: SVs (Cancer GIAB)
description:
  Build a tumor/normal HiFi site from raw reads, and read its benchmark SV and
  CNV calls against the alignments that support them
guide_category: Tutorials
tutorial_category: Cancer genomics
data: pipeline
---

**TL;DR:** the Cancer Genome in a Bottle project publishes HG008, a matched
tumor/normal PDAC cell line, as PacBio HiFi reads, a draft SV and CNV benchmark,
and a telomere-to-telomere assembly of the tumor. Load them as tracks and read
each benchmark call against the alignments and the copy number under it, in a
tumor genome that is hypodiploid, so the depth baseline is not two.

## Prerequisites

- A machine with HTTP access, either a public URL or `http://localhost`
- Approximately 1 TB of free disk space to build the tracks from the raw reads,
  or ~1.5 TB to run the full reproduce pipeline below (the BAM/CRAM files are
  large)
- At least 32 GB of RAM for the minimap2 alignment step. Only data preparation
  needs it; a 2 GB instance hosts the finished site.
- The following command-line tools, with versions tested at the time of writing
  in parentheses:
  - [JBrowse CLI](/docs/cli) (`@jbrowse/cli` v3.6.5 or later)
  - [Node.js](https://nodejs.org/) (v18 minimum, v24.1.0 used for this tutorial)
  - [tabix](http://www.htslib.org/doc/tabix.html) (v1.21 or later)
  - [samtools](http://www.htslib.org/) (v1.21 or later)
  - [minimap2](https://github.com/lh3/minimap2)
  - [megadepth](https://github.com/ChristopherWilks/megadepth) (v1.2.0 or
    later), for the coverage tracks
  - [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (v1.0 or later),
    for the binned depth track

## The C-GIAB dataset

[Cancer Genome in a Bottle (C-GIAB)](https://www.nist.gov/programs-projects/cancer-genome-bottle)
publishes HG008, a pancreatic ductal adenocarcinoma (PDAC) cell line with
matched tumor (HG008-T) and normal pancreatic tissue (HG008-N-P) sequenced with
PacBio HiFi long reads, plus a near-complete telomere-to-telomere de novo
assembly of the tumor genome.

HG008-T is **hypodiploid**: its assembly recapitulates 35 tumor chromosomes
rather than 46, with widespread arm-level loss and 16 truncal interchromosomal
rearrangements
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). That matters
for every copy-number figure below, since the middle of a depth track is not
copy number 2 here and a balanced region is the exception. The benchmark CNV BED
reports absolute copy number per interval, so it is what every other track gets
read against.

For the full call sets, auxiliary assays and methods, see the
[NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)
and [McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-05438-2). The
[SV visualization guide](/docs/user_guides/sv_visualization) and the
[SV inspector guide](/docs/user_guides/sv_inspector_view) cover the concepts;
this page is the data-loading workflow and a few worked examples.

## Setting up

The instance itself is the [web quickstart](/docs/quickstart_web) unchanged. Two
of the prerequisites are release binaries rather than apt packages:

```bash
wget https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
chmod +x megadepth && sudo mv megadepth /usr/local/bin/
curl -L https://github.com/PacificBiosciences/HiFiCNV/releases/download/v1.0.1/hificnv-v1.0.1-x86_64-unknown-linux-gnu.tar.gz \
  | tar xz --strip-components=1 -C /usr/local/bin --wildcards '*/hificnv'
```

The assembly is the C-GIAB build of GRCh38, with decoys and several masked
regions. The build does not matter to the visualization, but the same one has to
be used when converting the BAMs to CRAM below, or every position reads as a
mismatch.

[Reproduce it end to end](#reproduce-it-end-to-end) fetches that reference and
every file below. What follows is the part that is track config rather than data
preparation.

## The benchmark SV and CNV calls

The V0.5 HG008-T draft benchmark SV calls (VCF) and CNV calls (BED) load as
remote URL tracks, with nothing downloaded.

The CNV BED ships without a header, so its columns beyond `chrom/start/end` load
unnamed. Rather than editing the file, name them on the adapter with the
[`columnNames`](/docs/config/bedadapter/#slot-columnnames) slot:

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

The tumor and normal BAMs at the C-GIAB FTP are large and slow to access
remotely, and lack `MD` tags, which JBrowse uses to display SNP positions
without re-fetching the reference. So each one gets pulled through
`samtools view` into a local CRAM against the reference above, with a
whole-genome coverage bigWig beside it:

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

The benchmark is one of five somatic SV callsets on this pair, and C-GIAB
publishes the other four. They load the way the CNV ones do, a URL each with
nothing downloaded:

| Callset                                                                                                                 | Called from                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| NIST V0.5 draft benchmark                                                                                               | assembly comparison plus read support          |
| [Severus](https://github.com/KolmogorovLab/Severus)                                                                     | PacBio HiFi                                    |
| [minda](https://github.com/KolmogorovLab/minda) ensemble                                                                | eleven caller runs over HiFi, ONT and Illumina |
| DRAGEN                                                                                                                  | Illumina WGS                                   |
| NYGC somatic pipeline ([Manta](https://github.com/Illumina/manta) and [GRIDSS](https://github.com/PapenfussLab/gridss)) | Illumina WGS                                   |

<Figure caption="The chr3 breakends of the benchmark's cluster_3 in five SV callsets, over the HiFiCNV depth and the benchmark's CNV lane: the V0.5 benchmark, Severus, the minda ensemble, DRAGEN and NYGC's BEDPE. Every callset marks both breakends, the depth between them sits at half its flanking level, and the CNV lane crosses the whole window as one balanced segment." src="/img/sv_cgiab/sv_callset_comparison.png" />

The benchmark files those two breakends under one `EVENT`, and the depth says
what they bound: the interval between them carries half the copies its flanks
do, with both steps landing where the callsets put a breakend. The benchmark CNV
BED covers the same window with a single CN 2 segment named `noCNV`, which is
the scale that callset works at, so an event this size is the SV lanes' to
carry.

The second junction is written two ways. The benchmark and minda place a
breakend; Severus and DRAGEN write a symbolic inversion whose `SVLEN` runs 54 Mb
down the arm, so those two lanes draw a span leaving the window where the others
draw a mark.

### Severus and DRAGEN

Both are one indexed VCF, and both are records at a breakend rather than spans,
so they load with no display settings:

```json addtrack
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

```json addtrack
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

DRAGEN's record over the chr3-chr13 junction is one to click rather than to read
off the lane: it places the breakend where the others do and then carries
`MaxDepth` in its own `FILTER` column, the depth cap a caller applies where a
pileup runs far above the genome average.

### minda: the caller runs behind each junction

The ensemble callset is a plain VCF, so [`VcfAdapter`](/docs/config/vcfadapter)
loads it whole rather than by index:

```json addtrack
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

Each record's `SUPP_VEC` names the individual caller runs that supported it,
prefixed by the technology they ran on: `PB_severus_BND1941_1`,
`ONT_Sniffles2.INV.30AM2`, `ILL_gridss63ff_2860h`. Clicking a junction is then
how many independent runs saw it, and on which reads, and it is the field that
says whether a call rests on one technology.

### NYGC: a BEDPE, and the arcs it can be drawn as

[`BedpeAdapter`](/docs/config/bedpeadapter) reads a paired-end BED whole, with
no index, and serves it to a variant track. The `#` header names the columns, so
each record arrives with the pipeline's call, the strands, the CNV changepoints
it was linked to, and an `evidence` column holding each tool's split-read and
paired-end counts:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "hg008t_nygc_sv",
  "name": "HG008-T NYGC somatic SVs (Manta, GRIDSS)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedpeAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/HG008-T--HG008-N.sv.annotated.v7.somatic.high_confidence.final.bedpe"
  }
}
```

Each record holds both ends, so the whole callset reads as arcs at chromosome
scale: **Display types → Variant display arcs** on the track menu draws one arc
per record between its two breakends. At the base-level zoom the figure above
uses, an arc leaves the window at both ends, and the default display's marks are
what line up against the other callsets.

## Copy number from the published callsets

Four groups have called copy number on this tumor/normal pair, and the
[NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)
publishes each one's output. Every file is small and loads from its FTP URL, so
all four callsets can share one view:

| Callset                                                                                                                                  | Called from                           | Each segment carries                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| NIST V0.5 draft benchmark                                                                                                                | assembly comparison plus read support | absolute total and per-haplotype copy number                                |
| [Wakhan](https://github.com/KolmogorovLab/Wakhan)                                                                                        | PacBio HiFi, phased with Hi-C         | copy number per parental haplotype, with LOH intervals in a second file     |
| NYGC somatic pipeline, [BIC-seq2](https://doi.org/10.1073/pnas.1110574108)                                                               | Illumina WGS                          | log2 tumor-versus-normal copy ratio, and the genes the segment covers       |
| [DRAGEN](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/) | Illumina WGS                          | integer copy number, minor-haplotype copy number and minor allele frequency |

The benchmark CNV BED added above is the lane the others get read against, since
its copy numbers are absolute. It states its diploid regions explicitly as CN 2,
and it leaves out segments whose breakpoints the project could not place on
GRCh38, so a gap in that lane is a gap in the benchmark and not a call of no
change. Depth per bin is the one signal no callset publishes, and the end of
this section computes it from the tumor reads.

<Figure caption="Four published CNV callsets over chr9p21.3, with the HiFiCNV depth and B-allele frequency above them: the V0.5 benchmark, NYGC's annotated BIC-seq2 segments, DRAGEN's somatic CNV VCF, and Wakhan's two haplotype rows. Depth drops out over CDKN2A, where the benchmark and NYGC both carry a focal call and the two coarser segmentations run straight through." src="/img/sv_cgiab/cnv_callset_comparison.png" />

### DRAGEN: integer copy number from short reads

Each record in DRAGEN's somatic CNV VCF is one segment, and its ID names the
class the caller assigned: `LOSS`, `GAIN`, `CNLOH` for copy-neutral loss of
heterozygosity, and `REF` for a segment left at the reference state. Clicking a
segment shows the copy number `CN`, the minor-haplotype copy number `MCN`, and
the minor allele frequency behind both.

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

The VCF header carries DRAGEN's purity and ploidy estimate for the sample, and
its ploidy lands below two: the hypodiploidy the assembly reports, arrived at
from short reads by another caller.

### NYGC: a copy ratio, and the genes each segment covers

The New York Genome Center's somatic pipeline ran on this same pair, and C-GIAB
publishes its CNV output two ways. `HG008-T--HG008-N.cnv.annotated.v7.final.bed`
needs nothing done to it: its `#` header line is tab-separated, so the adapter
takes the column names from the file and each segment arrives carrying its call,
its log2 copy ratio, whether the pipeline flagged the event focal, its cytoband,
and the Cancer Gene Census genes it covers.

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
    "color": "jexl:feature.type=='DEL'?'#2166ac':'#b2182b'",
    "labels": { "name": "jexl:feature.type+' '+feature.cytoband" },
    "displayMode": "compact",
    "legend": [
      { "label": "Loss (DEL)", "color": "#2166ac" },
      { "label": "Gain (DUP)", "color": "#b2182b" }
    ]
  }
}
```

Clicking a segment shows that annotation, its census genes listed with their
tier.

`HG008-T--HG008-N.bicseq2.txt` is the same segmentation in quantitative form,
one log2 ratio per segment, and it reshapes into a bedGraph in one `awk` line.
Plot it as a **line (step)** over a fixed range, which keeps a homozygous
deletion (no reads, so no finite ratio) from setting the axis for a whole
chromosome. The balanced baseline sits above zero because BIC-seq2 normalizes on
total read counts and this genome is hypodiploid; the track is shown as
published, and it is the steps that get read against the benchmark's absolute
copy numbers.

### Wakhan: copy number per parental haplotype

A log2 ratio and a folded allele frequency both average the two parental alleles
together, so at whole-genome zoom an LOH block reads as balanced.
[Wakhan](https://github.com/KolmogorovLab/Wakhan) phases the germline
heterozygous SNPs and reports copy number _per haplotype_ instead, which keeps
the LOH signal at every zoom. C-GIAB publishes two Wakhan runs on this tumor,
and the later one phases the normal with Arima Hi-C alongside the HiFi reads:
`HG008_HiFi_HiC_copynumbers_segments.bed` and `HG008_HiFi_HiC_loh_segments.bed`,
both of them URL tracks.

The copy-number file is worth a few more lines of config than `add-track`
writes. It is long format, one row per haplotype, and its column-name line
carries no `#`:

```
chr	start	end	copynumber_state	coverage	haplotype
chr1	0	23750000	2	106.025	1
chr1	23750001	119650000	0.72	58.025	1
```

so the names go on the adapter through
[`columnNames`](/docs/config/bedadapter/#slot-columnnames). That header line
loads as a feature on a refName no assembly has, where nothing draws it.

Because a haplotype column already assigns each segment to a row, this is a
[`LinearMultiRowFeatureDisplay`](/docs/config/linearmultirowfeaturedisplay)
track: set
[`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
to `haplotype` and it paints one row per parental copy.

```json
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
      "partitionField": "haplotype",
      "color": "jexl:get(feature,'copynumber_state')<0.5?'#2166ac':get(feature,'copynumber_state')<1.5?'#bdbdbd':'#f4a582'",
      "legend": [
        { "label": "Haplotype lost (0)", "color": "#2166ac" },
        { "label": "One copy", "color": "#bdbdbd" },
        { "label": "Two or more copies", "color": "#f4a582" }
      ]
    }
  ]
}
```

`copynumber_state` is one parental copy rather than the total, so `1` is the
expected state and a `0` row is the lost haplotype that makes an arm LOH. Wakhan
emits fractional states for segments that are not clonal, so bucket the color
rather than matching integers exactly. `coverage` is Wakhan's median depth for
the segment, where the per-copy depth scale can be read directly.

### Depth per bin, and B-allele frequency

The coverage bigWigs above are raw depth over the whole genome, and the two
tracks that make copy number readable next to the callsets get built from the
tumor reads. [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV), PacBio's
somatic CNV caller, writes the binned depth bigWig:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# --maf holds the TUMOR's small-variant calls, the Clair3 tumor VCF published
# alongside C-GIAB's Wakhan run: HiFiCNV reads AD out of this VCF for its own
# allele-frequency output and never looks at --bam for it
hificnv --bam HG008-T.cram --ref GRCh38.fa --maf tumor_smallvariants.vcf.gz \
  --output-prefix hificnv
```

Each output file is named for the sample it came from, so the depth bigWig is
named for the `--bam` sample and takes the **scatter** rendering. Depth is a
read count per bin, so a whole-chromosome view is a cloud hundreds of points
deep and a copy-number step is wherever its centre moves; the NYGC copy ratio
above is the same event already segmented.

The allelic panel is **B-allele frequency**, unfolded. HiFiCNV's own `maf.bw`
folds to `min(AF, 1-AF)`, so a region that has lost one parental copy collapses
onto a single band near 0. Unfolded BAF keeps the two apart: a balanced region
is one band at 0.5, a loss-of-heterozygosity region two bands at 0 and 1. Build
it by piling up the tumor reads at the sites the **normal** calls heterozygous
and taking the alt fraction:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# het sites from the NORMAL, which is the choice the whole track rests on: an LOH
# site is homozygous in the tumor, so a tumor-derived list drops exactly the
# sites the track exists to show
bcftools view -g het -Oz -o hets.vcf.gz normal.deepvariant.vcf.gz
tabix -p vcf hets.vcf.gz
cut -f1,2 GRCh38.fa.fai > GRCh38.chrom.sizes

# -q 1 drops multi-mapped reads, -Q 0 leaves HiFi base qualities alone
bcftools mpileup -f GRCh38.fa -T hets.vcf.gz -a AD -q 1 -Q 0 tumor.bam |
  bcftools query -f '%CHROM\t%POS\t[%AD]\n' |
  # unfolded alt fraction, so LOH separates into 0 and 1 instead of folding
  # onto one band; the 10x floor keeps thin coverage from painting a fake 0/1
  awk -F'[\t,]' '{d=$3+$4; if (d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' |
  LC_COLLATE=C sort -k1,1 -k2,2n > baf.bedgraph
bedGraphToBigWig baf.bedgraph GRCh38.chrom.sizes tumor_baf.bw
```

Plot it with **scatter** over a fixed 0 to 1 range, since the spread is the
entire signal and a line rendering would average the two LOH bands back to 0.5.

<Figure caption="Chromosome 3 over the benchmark CNV calls: BIC-seq2's segmented log2 copy ratio, the HiFiCNV depth it summarizes, and B-allele frequency. The p-arm is a single-copy loss with loss-of-heterozygosity; the q-arm is balanced." src="/img/sv_cgiab/cnv_depth_baf.png" />

#### Keep the BAF track off bigWig summaries

A bigWig carries precomputed zoom levels, and each zoomed bin holds only a
minimum, an average and a maximum. That is a fair summary of read depth and a
meaningless one for BAF, which is a _distribution_: every bin over an LOH arm
comes back as minimum 0, maximum 1 and an average that wanders. The default
[`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode) of
`whiskers` draws all three, so the split this track exists to show paints as a
solid full-height wash.

Fix it on the adapter, not the display, with
[`resolutionMultiplier`](/docs/config/bigwigadapter/#slot-resolutionmultiplier).
It scales the bases-per-bin the adapter asks for, and a small enough value keeps
the fetch on the raw per-site values at the zoom levels these figures use:

```json
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
    "defaultRendering": "scatter",
    "scatterPointSize": 1,
    "minScore": 0,
    "maxScore": 1
  }
}
```

Raw het sites are cheap here: a whole chromosome is well under two megabytes,
because the track only carries one value per heterozygous site rather than one
per base. Whole-genome view still falls back to the summary, which is what
Wakhan's segments above are for.

**Resolution → Finer** in the track menu is the same control interactively.
Reach for it whenever a scatter track looks like a filled band rather than a
cloud of points.

### Subclonal copy number

Every callset above averages over the tumor cells it was sequenced from, so a
change carried by only part of the tumor reads as a muted, intermediate signal.
This line carries that mixture: karyotyping across passages finds the arm-level
losses shared by nearly all cells but the genome-doubled fraction of the
population growing between early and late passage, so ploidy is mixed
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). The
benchmark CNV BED reports copy number for the cells that have not doubled.

C-GIAB publishes short-read WGS for a panel of HG008-T single-cell-derived
clones under
[`HG008-T_clones/`](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/NIST/HG008-T_clones/),
one colony grown from a single tumor cell, so each reports one subclone's copy
number. Called per clone and merged into one BED with a `clone` column, they
partition into rows the same way the Wakhan haplotypes do, and a row that
departs from the rest marks a CNV private to that subclone:

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
      "partitionField": "clone",
      "color": "jexl:get(feature,'cn')<1?'#2166ac':get(feature,'cn')<2?'#92c5de':get(feature,'cn')<3?'#e0e0e0':get(feature,'cn')<4?'#f4a582':'#b2182b'",
      "legend": [
        { "label": "CN 0", "color": "#2166ac" },
        { "label": "CN 1", "color": "#92c5de" },
        { "label": "CN 2", "color": "#e0e0e0" },
        { "label": "CN 3", "color": "#f4a582" },
        { "label": "CN 4+", "color": "#b2182b" }
      ]
    }
  ]
}
```

Read those integers on the caller's own scale: CNVkit centers each sample's log2
on that sample's own median, so on a hypodiploid genome the balanced state is
not the row's CN 2. The benchmark CNV track in the same view is what anchors
them, its `total_copy_number` being absolute.

## Align the tumor assembly to GRCh38

The C-GIAB project provides a near-complete telomere-to-telomere de novo
assembly of HG008-T
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)),
haplotype-resolved into T2T scaffolds. Load it as a second JBrowse assembly and
align it to GRCh38, which gives a PAF that JBrowse renders in the synteny and
dotplot views:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# asm5 is the same-species preset; -c emits the base-level CIGAR the synteny
# view needs to draw a junction at base scale
minimap2 -cx asm5 GRCh38.fa HG008T_v3.2.fasta > HG008T_v3.2.paf

# -a is query,target, the REVERSE of the target query minimap2 just took: get it
# backwards and the view opens empty rather than erroring
jbrowse add-track HG008T_v3.2.paf -a HG008T_v3.2,GRCh38_GIABv3
```

The matched normal assembly (`HG008N_v6.3.fasta.gz`, same S3 path) loads the
same way. See the
[synteny track config guide](/docs/config_guides/synteny_track) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

## Walkthroughs

Once your JBrowse 2 instance is live, the loaded data reads three complementary
ways: the SV inspector for whole-genome triage, the linear genome view for
read-level detail and copy number, and the dotplot/synteny views for
chromosome-scale rearrangements in the assembly.

### Walkthrough: a chr3-chr13 translocation

**Add → SV inspector**, then **Open from track** to pick the C-GIAB benchmark
VCF loaded earlier.

<Figure caption="The SV inspector showing the benchmark VCF as a circular overview alongside a table of calls." src="/img/sv_cgiab/translocation_sv_inspector_view.png" />

Clicking the chord that connects chr3 and chr13 launches a breakpoint split
view. Opening the tumor PacBio HiFi reads on each panel and setting **Read
height** → **Compact** highlights the supporting split reads as black splines
connecting the two chromosomes.

<Figure caption="Clicking the chord joining chr3 and chr13 opens a breakpoint split view. Black splines connect tumor PacBio HiFi reads that partially map to each chromosome, suggesting a fusion or translocation." src="/img/sv_cgiab/translocation_breakpoint_split.png" />

That chord is one breakend of a larger event. The V0.5 benchmark tags `SV_20`
with `EVENTTYPE=CHROMOPLEXY` and files it under `EVENT=cluster_3` with its mate
on chr13 and two further breakends on chr3. Interchromosomal translocations in
HG008 are frequently complex this way
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), which is why
the assembly views below are worth reaching for once a chord has said where to
look.

For the SV inspector workflow itself (filtering the table, search, configuring
the circular overview), see the
[SV inspector guide](/docs/user_guides/sv_inspector_view).

### Walkthrough: the same junction three ways

The chord says where to look. Three things in this instance say what is there,
and none of them is derived from the others.

**The caller.** `SV_20` and `SV_190` are one junction written twice, joining
chr3:139,976,414 to chr13:114,353,244. A BND record names one partner, so on its
own each describes a translocation and nothing more. The `EVENT` field is what
says otherwise: the benchmark files both under `cluster_3` alongside two further
breakends and tags them `EVENTTYPE=CHROMOPLEXY`. A caller can group junctions
into an event because it sees the whole callset at once. It cannot say which
molecule carries them.

**The reads.** Put both breakpoint loci on screen and, from the tumor PacBio
HiFi track's menu, choose **Launch view → Reconstruct derivative allele...**.
The reads in the window are grouped by the route their split alignments
describe, each offered with the number of reads that independently take it. The
top route runs chr13 forward into the junction and then down chr3 inverted, the
orientation the black splines above draw. The matched normal is the control and
a track away: the tumor reads split at this position, the normal reads read
through it.

<Figure caption="Reconstruct derivative allele over both breakpoint loci of the tumor PacBio HiFi track. The top route, chr13 forward then chr3 inverted, is the junction the benchmark and the tumor assembly both name." src="/img/sv_cgiab/three_ways.png" />

**The assembly.** The synteny track loaded earlier says the same thing from no
reads at all. The C-GIAB assembly resolves both loci onto a single tumor contig,
and named that contig for the two chromosomes it fuses. Its chr13 arm ends at
the chr13 breakend above and its chr3 arm begins at the chr3 one, abutting at a
single base of contig coordinate, with the same orientation flip the reads
describe. Open it in the synteny or dotplot view against GRCh38 and the junction
is the point where one contig stops following chr13 and starts following chr3.

Reading the list below the top route is the other half of the exercise. This
window ends at the chr13 q-terminus, so most of what is offered under the real
junction is reads mismapped into the terminal repeats of other chromosomes, each
a confident-looking two-segment route with a real read count behind it. The read
count ranks the routes rather than vouching for them; what vouches for this one
is that the caller and the assembly put its two ends in the same two places.

The reconstruction is bounded twice by what is loaded. It is assembled from the
reads in the **displayed regions**, so a locus not on screen contributes no
route however plainly its reads describe one, which is why both sides of this
junction are open above. And the hosted demo slices the tumor reads to the loci
these walkthroughs visit, so the reads reach one of `cluster_3`'s junctions
where the assembly contig carries both. Rebuilding from the full BAM with
[the build script](#reproduce-it-end-to-end) lifts that limit.

### Which of these calls are drivers

Most somatic calls in a tumor genome are passengers: real events, carried along
by the cell lineage, with no role in the cancer. A handful are drivers. In
pancreatic ductal adenocarcinoma the recurrently altered genes are _KRAS_,
_CDKN2A_, _TP53_ and _SMAD4_
([Waddell et al. 2015](https://doi.org/10.1038/nature14169),
[Bailey et al. 2016](https://doi.org/10.1038/nature16965)), and the copy-number
walkthroughs below visit all four in this genome.

Nothing in the browser marks that distinction: the benchmark BED states copy
number and haplotype rather than consequence, and neither does the gene track.
The somatic driver catalogues that would answer it as a lane (COSMIC's Cancer
Gene Census among them) are licensed rather than redistributable, so a public
demo cannot carry one. The NYGC segments loaded above carry theirs inline, each
one listing the census genes inside it. Every copy-number figure below also
draws one MANE Select transcript under the lanes, so the event and the gene it
covers are read off the same axis.

### Walkthrough: a small deletion in CUZD1

For small to medium SVs the linear genome view is usually enough. Use the
**search** (magnifying glass) button in the SV inspector to find a specific
call, for example `SV_85`, a heterozygous deletion that affects two exons of
_CUZD1_.

_CUZD1_ is a passenger here: a pancreatic acinar protein predicted to act in
trypsinogen activation
([NCBI Gene 50624](https://www.ncbi.nlm.nih.gov/gene/50624)), not one of the
four PDAC genes above, with one heterozygous copy remaining. It makes a good
first example because a ~1.8 kb deletion over two exons is small enough to read
base by base and large enough to see in a pileup.

A public catalogue puts that in a lane. **ClinVar CNVs** carries the submitted
copy-number variants with their clinical significance. Add it from UCSC:

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
  "displayDefaults": {
    "jexlFilters": ["get(feature,'_varLen') < 50000"],
    "displayMode": "compact"
  }
}
```

The size filter is what makes the lane readable: ClinVar holds chromosome-scale
records that merely contain a 1.8 kb event, so unfiltered the lane is one bar
edge to edge. `_varLen` is the catalogue's own length field, and filtering on it
keeps the records at this event's scale.

The lane is then empty over this locus, which is the reading: no submitted
ClinVar CNV at anything like this deletion's size covers it.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion, and the linear genome view its location link opens: the <DEL> ALT allele over the ClinVar CNV and NCBI RefSeq gene lanes." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Open the gene annotations and the tumor PacBio HiFi reads, set **Read height →
Compact** and **Sort by... → Base pair** from the track menu, and center the
deletion. The view menu's **center line** helps line the breakpoint up.

<Figure caption="Tumor PacBio HiFi reads at compact height, sorted by base pair with the deletion centered, over the gene annotations. The deletion removes two CUZD1 exons and is heterozygous." src="/img/sv_cgiab/deletion_linear_view.png" />

For background on SV signals in the alignments track, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

### Walkthrough: reading copy number

The quickest copy-number check is the tumor and normal coverage bigWigs as one
multi-bigwig track, which is fast at any zoom level:

- **Show all regions in assembly** on the linear genome view start screen opens
  every chromosome at once.
- A manual **min/max score** cap from the track menu keeps a few centromere and
  repeat spikes from compressing the copy-number signal.
- **Overlapping scatter** plots the two samples as points in one band, tumor red
  and normal blue.

Zoom to a region and open the benchmark CNV BED to check the coverage changes
against the called intervals. Coverage says a level changed but not what
changed, so put the BAF track in the same window: chromosome 5 carries three
different answers, each a different shape in that lane.

<Figure caption="The linear genome view start screen: click Show all regions in assembly to lay out every chromosome across the view." src="/img/sv_cgiab/cnv_show_all_regions.png" />

<Figure caption="Chromosome 5: the segmented copy ratio, tumor and normal indexcov coverage as overlapping scatter, B-allele frequency, and the benchmark CNV calls. The normal stays flat while the tumor steps, and the BAF lane says what each step is." src="/img/sv_cgiab/cnv_with_bed_track.png" />

Raw coverage is only a sanity check on existing calls. For a signal that reads
directly as copy number, use the depth, BAF, and copy-number tracks built above.
Four loci in HG008-T each carry a different copy-number state:

| Locus  | State in HG008-T                 | Signature on the tracks             |
| ------ | -------------------------------- | ----------------------------------- |
| CDKN2A | Focal homozygous deletion (CN 0) | depth to 0, copy number 0           |
| TP53   | 17p loss + LOH (CN 1, 1+0)       | depth halved, BAF splits to 0 and 1 |
| SMAD4  | 18q loss + LOH (CN 1, 0+1)       | depth halved, BAF splits to 0 and 1 |
| KRAS   | Tandem duplication (CN 3, 2+1)   | depth raised, BAF to 1/3 and 2/3    |

All four are among the genes most commonly mutated in PDAC, and all four carry
clonal somatic variants in HG008
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

Keep the BAF track unfolded: folding onto 0 to 0.5 collapses each of those band
pairs onto one line.

Arm-level loss is widespread in this hypodiploid genome, so the single band at
0.5 is the exception rather than the backdrop. When a whole chromosome is LOH
end to end, as chr17 is below, nothing in that view is balanced and the
reference band has to come from another chromosome.

#### CDKN2A: a homozygous deletion vs a single-copy loss

Navigate to `CDKN2A` on chr9. The benchmark calls a focal ~20 kb homozygous
deletion (`SV_75`, total copy number 0) over the gene. A homozygous deletion
removes both parental copies, so depth goes to ~0 and HiFiCNV's copy number
drops to 0; a single-copy loss only halves depth. This deletion sits within a
larger single-copy-loss arm (`CNA_14`, 0+1), so it reads as a deeper notch in an
already-reduced baseline: the focal event removes the one copy the arm-level
loss had left
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

Load the tumor and matched normal per-base coverage as one
[multi-quantitative track](/docs/user_guides/multiquantitative_track), one row
per sample. Set an explicit score range from the track menu rather than
autoscaling, so both rows are drawn on the same scale.

HiFiCNV's depth is binned, so these coverage tracks are per-base. For the exact
breakpoints, open the PacBio HiFi read pileup below them.

The benchmark's `total_copy_number` is absolute, so CN 2 is a diploid segment.
Nothing in this window is diploid: the whole of 9p has lost a copy in this
tumor, so CN 1 is the local background and the deletion is punched into it.
Widen the view several hundred kilobases to the right to find the first CN 2
segment and read the CN 1 lane against it.

The thin lines crossing the gap in the pileup are single reads carrying the
deletion as one gap in their alignment.

<Figure caption="The CDKN2A deletion at 60 kb: coverage drops out in the tumor row and not in the normal, the read pileup drops out with it, and the CNV call under them reads CN 0." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

#### chr17: loss-with-LOH vs copy-neutral LOH

Chromosome 17 shows why the BAF track is read alongside depth. Open the whole
chromosome with the depth track above the BAF:

- the p-arm (covering _TP53_) is a single-copy loss with LOH (`CNA_20`, CN 1,
  1+0): depth is halved and the BAF splits away from 0.5.
- the q-arm is copy-neutral LOH (`CNA_21`, CN 2, 2+0): one parental haplotype
  was lost and the other duplicated, so total copy number is still 2 and depth
  stays flat, yet the BAF still splits away from 0.5.

The q-arm event is invisible to depth alone, which is why the two tracks are
read together.

The copy-ratio lane in the figure fills from a pivot at zero, and on this
hypodiploid genome the balanced level sits above zero, so the q-arm's
copy-neutral state fills upward in the gain color. Read that lane for where its
steps are, not for which side of the midline they land on.

<Figure caption="Chromosome 17: the segmented copy ratio, the HiFiCNV depth, the BAF and the benchmark CNV calls. The p-arm is a single-copy loss with LOH; the q-arm is copy-neutral LOH, flat in both copy-number lanes and still split in the BAF." src="/img/sv_cgiab/cnv_chr17_loh.png" />

The depth and BAF combinations read as a compact decision table:

| depth       | BAF             | Interpretation            |
| ----------- | --------------- | ------------------------- |
| flat (CN 2) | one band at 0.5 | balanced diploid          |
| flat (CN 2) | split to 0, 1   | copy-neutral LOH          |
| halved      | split to 0, 1   | single-copy loss with LOH |
| raised      | 1/3 and 2/3     | allelic gain              |

The benchmark BED's per-haplotype columns (`hap1_copy_number`,
`hap2_copy_number`) encode this allelic state: any segment with a `0` haplotype
(e.g. `1+0`, `2+0`) has lost one parental allele and its BAF splits away from
0.5, regardless of its total copy number. Clicking a CNV feature shows these
values in the feature details, so you can confirm the allelic call against the
BAF track directly.

#### KRAS and SMAD4

The same reading covers the other two loci. _KRAS_ on chr12 sits in a gain
(`SV_101`, CN 3, 2+1): the assembly resolves it as a 2 Mb tandem duplication
carrying the G12V-mutated copy, an event associated with advanced disease
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). Depth is
raised over the duplicated span and the BAF moves to 1/3 and 2/3, the partial
imbalance of a 2+1 gain rather than the full drop of a complete haplotype loss.
Because the event is a couple of megabases rather than an arm, zoom to it: at
whole-chromosome scale it is a handful of pixels wide.

<Figure caption="KRAS on chr12: its MANE Select transcript over the segmented copy ratio, the HiFiCNV depth and the BAF, above the CNV calls. Over the tandem duplication the copy-ratio edges land on the called boundaries and the BAF separates into two bands." src="/img/sv_cgiab/driver_kras_gain.png" />

_SMAD4_ on 18q is lost with LOH (`CNA_48`, CN 1, 0+1), the mirror image of the
_TP53_ event. Two controls are in the same picture: the balanced p-arm, and the
matched normal on the same axis as the tumor.

The copy ratio is a log2 of tumor over normal, so read it against zero. Leave
the display's bicolor mode on and it fills from a zero pivot, loss below the
midline and gain above; a symmetric axis keeps the two the same distance.

<Figure caption="Chromosome 18: SMAD4's MANE Select transcript over the segmented copy ratio, the tumor and its matched normal from indexcov, and the BAF, above the CNV calls. All three lanes change together from ~30 Mb to the telomere." src="/img/sv_cgiab/driver_smad4_loh.png" />

See also the
[multi-quantitative track guide](/docs/user_guides/multiquantitative_track) for
comparing tumor and normal coverage.

### Walkthrough: synteny and dotplot views of the tumor assembly

Showing the tumor assembly side-by-side with the reference can make complex SVs
easier to read than the alignment track alone. **Add → Dotplot view**, set the
de novo assembly as one axis and GRCh38 as the other, and pick the matching
synteny track.

<Figure caption="The dotplot import form, with the HG008-T v3.2 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

Drag over a region and open a linear synteny view (below), then zoom in on a
breakpoint to read it at base level.

HG008-T v3.2 is haplotype-resolved, so its scaffold names end in `_hap1` or
`_hap2` and one plot stacks both on the same axis, doubling every diagonal.
Restrict the y axis to one haplotype at a time and each plot reads as a plain
assembly-vs-reference diagonal.

<Figure caption="Haplotype 1 of HG008-T v3.2 (y) against GRCh38 chromosomes (x). Each scaffold is one diagonal segment; scaffolds named for two chromosomes (chr3_chr13_hap1) break into two, which is the translocation." src="/img/sv_cgiab/dotplot_hap1.png" />

<Figure caption="The same plot for haplotype 2. chr13_hap2 carries a single clean diagonal against chr13, the untranslocated counterpart to hap1's fused scaffold." src="/img/sv_cgiab/dotplot_hap2.png" />

Use **Launch → Linear synteny view** from the drag selection, keep **HG008T
v3.2** as the dialog's synteny dataset, then enter `chr3 chr13` in the GRCh38
search box to focus on those chromosomes. Raising the **minimum alignment
length** (in the synteny view's menu) drops short, noisy anchors so the large
syntenic blocks read clearly.

<Figure caption="A synteny view launched from the chr3/chr13 selection in the dotplot: GRCh38 chr3 and chr13 above, the fused chr3_chr13_hap1 scaffold and chr13_hap2 below, at a raised minimum alignment length." src="/img/sv_cgiab/synteny_view.png" />

The chr3/chr13 fusion is one of 16 truncal interchromosomal rearrangements here.
Seven of the 16 hybrid chromosomes break in or near a centromere and nine
involve non-reciprocal foldback inversions
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), which is
exactly what reference-based callers leave unresolved when the sequence either
side is satellite repeat. A scaffold named for two GRCh38 chromosomes is the
cue, so the names on the dotplot's y axis are a worklist.

For more on these views, see the
[dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

### Walkthrough: methylation on the tumor reads

The C-GIAB PacBio HiFi BAMs carry per-read 5mC calls in their `MM`/`ML` tags,
and JBrowse renders those with no extra files: open the tumor reads and set
**Color by...** → **Modifications** from the track menu. The tags survive the
conversion to CRAM above, so the reads loaded for the SV walkthroughs already
carry them.

Most somatic LINE insertions in HG008 come from two hypomethylated non-reference
germline LINE insertions, so the methylation state of a source element explains
the insertion burden downstream of it
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). See
[Modifications and methylation](/docs/user_guides/alignments_track#modifications-and-methylation)
for the display modes, and the
[methylation tutorial](/docs/tutorials/methylation) for the aggregate and
allele-specific views.

## Data availability

Raw data from C-GIAB is under NCBI BioProject PRJNA200694. Processed data and
benchmark call sets are available from the
[NIST Cancer Genome in a Bottle page](https://www.nist.gov/programs-projects/cancer-genome-bottle).

## Where to go next

Nothing above is specific to C-GIAB. Swap the VCF, the CRAMs, the caller output
and the assembly for your own and the same tracks and walkthroughs apply. The
[SV visualization guide](/docs/user_guides/sv_visualization) covers the display
options the walkthroughs reach for: the color schemes (pair orientation, insert
size), the read filters (discordant pairs, soft-clipped), and the display modes
(pileup, read arcs, linked reads).

Within C-GIAB itself there is more on the same FTP than this tutorial loads:

- a **somatic small-variant draft benchmark**, published alongside the SV/CNV
  one used here, which loads as a variant track the same way
- the **matched normal assembly** (`HG008N`), which can be loaded as a second
  JBrowse assembly and used as the synteny target instead of GRCh38. Comparing
  the tumor assembly to the donor's own normal assembly rather than to the
  reference is what separates somatic change from germline difference, and it is
  the approach the C-GIAB assembly paper is built on
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

It grabs the C-GIAB GRCh38 build and the V0.5 HG008-T benchmark calls, turns the
tumor and normal HiFi BAMs into CRAMs, computes megadepth coverage, calls copy
number with HiFiCNV, builds the BAF bigWig, and loads the published Wakhan
haplotype-specific segments. It also aligns the T2T tumor assembly to GRCh38
with minimap2 for the synteny and dotplot views, then downloads JBrowse and
writes a `config.json` with everything loaded. The BAF and Wakhan tracks go in
with `add-track-json` rather than `add-track`, since the settings that make them
readable (`resolutionMultiplier` on one, `partitionField` on the other) are
track config rather than command-line flags.

It needs the tools listed under [Prerequisites](#prerequisites), plus `bcftools`
and `bedGraphToBigWig`. Be warned that it pulls down more than 200 GB, wants
roughly 1.5 TB of free disk and 32 GB of RAM, and the alignment and copy-number
steps take hours.

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/cancer_sv)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/multiquantitative_track)

## References

- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
- McDaniel et al. (2025).
  [Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-05438-2)
- Rautiainen et al. (2023).
  [Verkko: telomere-to-telomere assembly of diploid chromosomes](https://doi.org/10.1038/s41587-023-01662-6)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)
