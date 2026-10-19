---
title: 'Structural variants (Cancer GIAB) part 1: breakpoints'
sidebar_label: SVs (Cancer GIAB pt 1, breakpoints)
description:
  Load a tumor/normal HiFi site's five somatic SV callsets and read one
  translocation and one small deletion against the reads and the tumor assembly
guide_category: Tutorials
tutorial_category: Cancer genomics
---

The Cancer Genome in a Bottle project publishes HG008, a matched tumor/normal
PDAC cell line, as PacBio HiFi reads, a draft SV and CNV benchmark, and a
telomere-to-telomere assembly of the tumor. We read its structural variants
against the reads and the assembly; [part 2](/docs/tutorials/cnv_cgiab) reads
its copy number. We:

- load the benchmark SV calls and four further published SV callsets as variant
  tracks
- align the tumor assembly to GRCh38 and load the alignment as a synteny track
- open one chr3-chr13 translocation in the SV inspector and a breakpoint split
  view, and compare the tumor reads with the normal's
- read a small heterozygous deletion in _CUZD1_ in a read pileup, beside
  ClinVar's copy-number variants
- open the translocation in a dotplot and a linear synteny view of the assembly

## Prerequisites

The walkthroughs at the end also run on the hosted
[C-GIAB demo](https://jbrowse.org/code/jb2/latest/?config=https://jbrowse.org/demos/cgiab/config.json).
Building your own instance needs:

- A JBrowse instance, from the [web quickstart](/docs/quickstart_web)
- A machine with HTTP access, either a public URL or `http://localhost`
- ~1 TB of free disk for the tracks, or ~1.5 TB for the
  [full pipeline](#reproduce-it-end-to-end)
- At least 32 GB of RAM for the minimap2 step; only data preparation needs it.
- The command-line tools below, with the versions tested in parentheses:
  - [JBrowse CLI](/docs/cli) (`@jbrowse/cli` v3.6.5 or later)
  - [Node.js](https://nodejs.org/) (v18 minimum, v24.1.0 used for this tutorial)
  - [samtools](http://www.htslib.org/) (v1.21 or later)
  - [minimap2](https://github.com/lh3/minimap2)

<!-- TUTORIAL_INSTALL samtools,minimap2,node,jbrowse-cli START -->

```bash
# Debian/Ubuntu
sudo apt install samtools minimap2 nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools minimap2 nodejs
# any platform
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL samtools,minimap2,node,jbrowse-cli END -->

## The data

HG008, the C-GIAB matched tumor/normal pair (NCBI BioProject PRJNA200694), is on
the C-GIAB FTP, and the assemblies are on NIST's S3 bucket. The
[build script](#reproduce-it-end-to-end) takes these files from their URLs, over
200 GB and hours of download. The page's commands build local files from them,
and the tracks over those read them from disk; every other track reads a hosted
copy. Each step takes your own tumor and normal reads in place of HG008's.

| What it is                                                             | File                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The C-GIAB reference build (GRCh38 with decoys and masked regions)     | [GRCh38_GIABv3_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/release/references/GRCh38/GRCh38_GIABv3_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz) |
| The tumor/normal PacBio HiFi reads (Revio run, 116x tumor, 35x normal) | [PacBio_Revio_20240125/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/)                                                                                                                 |
| The V0.5 draft benchmark SV and CNV calls                              | [NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/)                            |
| Severus somatic SVs (HiFi)                                             | [severus_somatic.vcf.gz](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Severus-SV_20240308/somatic_SVs/severus_somatic.vcf.gz)                                                               |
| The minda ensemble SVs (HiFi, ONT and Illumina callers)                | [HG008_minda_ensemble.vcf](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH-NCI_minda-ensemble_20240710/HG008_minda_ensemble.vcf)                                                                    |
| DRAGEN's somatic SV calls (Illumina)                                   | [standard/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/)                                                                                                  |
| NYGC's somatic SVs (Illumina)                                          | [GRCh38-GIABv3/](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NYGC-somatic-pipeline_20240412/GRCh38-GIABv3/)                                                                                         |
| The T2T tumor assembly, v3.2                                           | [HG008T_v3.2.fasta.gz](https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/HG008T_v3.2/HG008T_v3.2.fasta.gz)                                                                                                   |
| The matched normal assembly, v6.3, which the build script leaves out   | [HG008N_v6.3.fasta.gz](https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/HG008N_v6.3/HG008N_v6.3.fasta.gz)                                                                                                   |

## HG008, a pancreatic tumor and its matched normal

[C-GIAB](https://www.nist.gov/programs-projects/cancer-genome-bottle) publishes
HG008 from one pancreatic ductal adenocarcinoma (PDAC) donor, as the tumor
(HG008-T) and normal pancreatic tissue (HG008-N-P). HG008-T is **hypodiploid**:
35 chromosomes down from 46, with widespread arm-level loss and truncal (present
in every tumor cell) interchromosomal rearrangements
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

## Assemblies: the C-GIAB GRCh38 reference and the tumor assembly

Every track below names one of two assemblies. The calls and reads sit on the
C-GIAB GRCh38 build, `GRCh38_GIABv3`, which GIAB hosts BGZF-compressed with its
`.fai` and `.gzi`, so the assembly reads it in place:

```json addassembly
{
  "name": "GRCh38_GIABv3",
  "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/release/references/GRCh38/GRCh38_GIABv3_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz"
}
```

The synteny and dotplot sections use `HG008T_v3.2`, the T2T tumor assembly. NIST
ships it BGZF-compressed, so `samtools faidx` writes the `.fai` and `.gzi`
beside it without decompressing:

```bash
curl -LO https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/HG008T_v3.2/HG008T_v3.2.fasta.gz
samtools faidx HG008T_v3.2.fasta.gz
```

```json addassembly
{
  "name": "HG008T_v3.2",
  "uri": "HG008T_v3.2.fasta.gz"
}
```

## The benchmark SV and CNV calls

The V0.5 HG008-T draft benchmark is an indexed VCF of SV calls and a BED of CNV
calls, both loaded straight from their FTP URL.

```json addtrack
{
  "trackId": "hg008t_benchmark_sv",
  "name": "HG008-T V0.5 draft benchmark somatic SVs",
  "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz",
  "assemblyNames": ["GRCh38_GIABv3"]
}
```

The CNV BED has no header, so
[`columnNames`](/docs/config/bedadapter/#slot-columnnames) names its columns. In
[grammar-of-graphics](/docs/config_guides/mark_display) terms, the track's
`color` is a color scale that maps the `field` `total_copy_number` through the
cuts in `domain` to the colors in `range`.

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
  },
  "displayDefaults": {
    "labels": {
      "name": "jexl:'CN '+feature.total_copy_number+' ('+feature.hap1_copy_number+'|'+feature.hap2_copy_number+')'"
    },
    "color": {
      "field": "total_copy_number",
      "scale": "threshold",
      "domain": [1, 2, 3, 4],
      "range": ["#2166ac", "#92c5de", "#e0e0e0", "#f4a582", "#b2182b"],
      "labels": ["CN 0", "CN 1", "CN 2", "CN 3", "CN 4+"],
      "title": "Copy number"
    }
  }
}
```

## Converting the HiFi reads to CRAM

The tumor and normal BAMs have no `MD` tags. Convert each to a local CRAM
against the reference above:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# -T: the reference for the CRAM, the same build the assembly was loaded from
# --write-index: write the .crai in the same pass
samtools view HG008-T.bam --write-index -o HG008-T.cram -T GRCh38.fa
```

Each CRAM is a read track that decodes against `GRCh38_GIABv3`; the normal uses
`HG008-N.cram`:

```json addtrack
{
  "trackId": "HG008-T_hifi",
  "name": "HG008-T PacBio HiFi",
  "uri": "HG008-T.cram",
  "assemblyNames": ["GRCh38_GIABv3"]
}
```

## Structural variants from the published callsets

C-GIAB publishes five somatic SV callsets for this pair, the benchmark among
them:

| Callset                                                                                                                 | Called from                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| NIST V0.5 draft benchmark                                                                                               | assembly comparison plus read support          |
| [Severus](https://github.com/KolmogorovLab/Severus)                                                                     | PacBio HiFi                                    |
| [minda](https://github.com/KolmogorovLab/minda) ensemble                                                                | eleven caller runs over HiFi, ONT and Illumina |
| DRAGEN                                                                                                                  | Illumina WGS                                   |
| NYGC somatic pipeline ([Manta](https://github.com/Illumina/manta) and [GRIDSS](https://github.com/PapenfussLab/gridss)) | Illumina WGS                                   |

### Loading Severus and DRAGEN SV calls

Severus and DRAGEN are indexed VCFs with a record at each breakend, so they load
with no display settings:

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

### Loading the minda ensemble SV calls

The minda ensemble callset is a plain VCF, so
[`VcfAdapter`](/docs/config/vcfadapter) loads it whole, with no index:

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

### Drawing the NYGC SV calls (BEDPE) as arcs

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
      "marks": [
        {
          "mark": "link",
          "encoding": { "size": 2 },
          "transform": [{ "type": "mate" }]
        }
      ]
    }
  ]
}
```

Open `chr3:139,970,000-140,005,000` with the five callsets loaded. A link whose
other breakend lies outside the view draws as a short stem, as both NYGC records
do below. The figure also shows the HiFiCNV depth, which
[part 2](/docs/tutorials/cnv_cgiab#building-depth-per-bin-and-b-allele-frequency-tracks)
builds.

<Figure caption="One benchmark rearrangement's breakends in the SV callsets, over the HiFiCNV depth and the benchmark's CNV track." src="/img/sv_cgiab/sv_callset_comparison.png" />

## Aligning the tumor assembly to GRCh38

The tumor assembly is haplotype-resolved into T2T scaffolds. The synteny and
dotplot views draw its alignment to GRCh38, a PAF file:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# asm5: minimap2's preset for an assembly against a reference of the same species
# -c: write base-level CIGARs
minimap2 -cx asm5 GRCh38.fa HG008T_v3.2.fasta > HG008T_v3.2.paf
```

The track lists the query assembly (the tumor assembly) first and the target
(GRCh38) second, the reverse of the minimap2 argument order; reversed, the view
opens empty and reports no error.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "HG008T_v3.2_paf",
  "name": "HG008T_v3.2 vs GRCh38_GIABv3",
  "assemblyNames": ["HG008T_v3.2", "GRCh38_GIABv3"],
  "adapter": {
    "type": "PAFAdapter",
    "uri": "HG008T_v3.2.paf"
  }
}
```

The matched normal assembly (`HG008N_v6.3.fasta.gz`, same S3 path) loads the
same way, as the [synteny track config guide](/docs/config_guides/synteny_track)
shows.

## Checking SV calls against reads and the assembly

### A chr3-chr13 translocation: breakpoint reads and the tumor contig

**Add → SV inspector**, then **Open from track** to pick the C-GIAB benchmark
VCF loaded earlier.

<Figure caption="The SV inspector showing the benchmark VCF as a circular overview alongside a table of calls." src="/img/sv_cgiab/translocation_sv_inspector_view.png" />

`SV_20` and `SV_190` are the two records of one breakpoint, where
chr3:139,976,414 joins chr13:114,353,244. The benchmark files them under
`EVENT=cluster_3` with two further breakends and tags the cluster
`EVENTTYPE=CHROMOPLEXY` (rearrangements chained across chromosomes). To read the
junction in the reads:

- Choose `cluster_3` under **Filter by event**, then click the chord joining
  chr3 and chr13 to launch the breakpoint split view.
- Set **Read height → Compact** on the tumor PacBio HiFi reads opened on each
  panel.
- **Sort by... → Split reads first** lifts the split reads to the top of each
  pileup.

[The cancer SV tutorial](/docs/tutorials/cancer_sv#following-the-chain-across-panels)
covers opening the view from a record and following the further breakends.

<Figure caption="Breakpoint split view of the chr3-chr13 translocation with tumor HiFi reads. Splines join the two halves of each split read." src="/img/sv_cgiab/translocation_breakpoint_split.png" />

We read the same junction three ways:

- In the tumor reads, each split read has one half on chr13 and one on chr3,
  joined by a spline. The read runs forward on chr13 into the junction, then
  continues on the reverse strand of chr3.
- In the matched normal, the reads run through the locus with no split. Open
  `HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3` from the hosted
  config on the same two panels.
- In the tumor assembly, the synteny track loaded earlier shows the junction
  with no reads. The C-GIAB assembly resolves both loci onto one tumor contig,
  named for the two chromosomes it fuses.

### CUZD1: a small heterozygous deletion

Use the **search** (magnifying glass) button in the SV inspector to find
`SV_85`, a heterozygous deletion of two exons of _CUZD1_
([NCBI Gene 50624](https://www.ncbi.nlm.nih.gov/gene/50624)). At about 1.8 kb,
the whole deletion fits in a pileup at base level.

The **ClinVar CNVs** track holds submitted copy-number variants and their
clinical significance, served by UCSC as a bigBed:

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
    "displayMode": "compact",
    "filter": ["jexl:feature._varLen < 50000"]
  }
}
```

The filter keeps ClinVar CNVs under 50 kb, and none of those covers this
deletion.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion, and the linear genome view its location link opens: the <DEL> ALT allele over the ClinVar CNV and NCBI RefSeq gene tracks." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Open **NCBI RefSeq genes (hg38)** from the hosted config and the tumor PacBio
HiFi reads, then set **Read height → Compact** and **Sort by... → Base pair** in
the reads' track menu and center the deletion. **Show... → Center line** in the
view menu helps line up the breakpoint.

<Figure caption="Tumor HiFi reads at compact height, sorted by base pair at the deletion." src="/img/sv_cgiab/deletion_linear_view.png" />

### Dotplot and synteny views of the tumor assembly against GRCh38

**Add → Dotplot view**, set the tumor assembly as one axis and GRCh38 as the
other, and pick the matching synteny track.

HG008-T v3.2's scaffold names end in `_hap1` or `_hap2`, so one plot stacks both
haplotypes and doubles every diagonal. In the import form, tick **Plot only
certain chromosomes** and type `*_hap1` into the chromosomes box of the
HG008T_v3.2 axis, then `*_hap2` in a second view, for a plain
assembly-vs-reference diagonal per haplotype.

<Figure caption="HG008-T's two haplotypes (y) against GRCh38 (x) as dotplots, hap1 left and hap2 right." src="/img/sv_cgiab/dotplot_haplotypes.png" />

Drag over a region and take **Launch → Linear synteny view**, keeping
**HG008T_v3.2 vs GRCh38_GIABv3** (**HG008T v3.2** in the hosted config) as the
synteny track, then enter `chr13 chr3` in the GRCh38 search box.

<Figure caption="The breakpoint split view's two reference windows with tumor reads grouped by split read, above the fused scaffold. A curve joins the two halves of each split read." src="/img/sv_cgiab/junction_synteny.png" />

**Add row** in the import form gives each haplotype a separate row: hap2,
GRCh38, hap1, with ribbons between each adjacent pair.

<Figure caption="A synteny view of hap2, GRCh38 chr13 and chr3, and the fused chr3_chr13_hap1 scaffold." src="/img/sv_cgiab/synteny_view.png" />

The [dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view) cover these
views.

## Reproduce it end to end

[`build_sv_visualization_cgiab.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_sv_visualization_cgiab.sh)
runs the data preparation above in one shot. The script:

1. Fetches the C-GIAB GRCh38 build and the V0.5 benchmark calls.
2. Runs the CRAM and minimap2 steps above, and the coverage, HiFiCNV and BAF
   steps of [part 2](/docs/tutorials/cnv_cgiab).
3. Downloads JBrowse and writes a `config.json` with all of it loaded beside the
   published Wakhan segments.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_sv_visualization_cgiab.sh
bash build_sv_visualization_cgiab.sh   # builds ./cgiab_build/jbrowse2
npx --yes serve cgiab_build/jbrowse2
```

The script downloads over 200 GB and takes hours.

## See also

- [](/docs/tutorials/cnv_cgiab)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/k562_fusions)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)

## Citations

- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
- McDaniel et al. (2025).
  [Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-05438-2)
- Rautiainen et al. (2023).
  [Verkko: telomere-to-telomere assembly of diploid chromosomes](https://doi.org/10.1038/s41587-023-01662-6)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)
