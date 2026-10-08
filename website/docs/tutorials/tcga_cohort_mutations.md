---
title: Mutation cohort (TCGA)
description:
  Read somatic point mutations across a thousand tumors as a genotype matrix,
  grouped by clinical annotation
guide_category: Tutorials
tutorial_category: Cancer genomics
---

We turn a TCGA project's somatic mutation calls into one matrix, each column a
distinct mutation and each row a tumor. JBrowse groups the rows by whichever
clinical field you point it at, receptor status or stage, so the mutations a
subtype shares line up.

## Prerequisites

- A JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop)) and the
  [JBrowse CLI](/docs/cli)

## Where the data comes from

TCGA-BRCA open-access somatic mutation calls from the GDC
([TCGA 2012](https://doi.org/10.1038/nature11412)).

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- primary-tumor **Masked Somatic Mutation** MAFs (mutation annotation format),
  queried and downloaded through the GDC API: https://api.gdc.cancer.gov/files
- per-tumor clinical annotation, from harmonized case fields and each case's
  clinical XML: https://api.gdc.cancer.gov/cases

The build script copies the hg38 reference and the MANE gene track from the
[hosted UCSC hg38 hub](https://genomes.jbrowse.org/ucsc/hg38/)'s config; that
MANE track is the gene lane the collapse-introns step below right-clicks.

## The cohort VCF and the clinical table {#what-the-two-files-hold}

The VCF is the GDC's per-tumor **Masked Somatic Mutation** calls merged into one
multi-sample file, one column per tumor:

```text
#CHROM POS       ID  REF ALT  INFO                          FORMAT    TCGA-A2-A0T2-01A  TCGA-A8-A07C-01A
chr3   179234297 .   A   G    GENE=PIK3CA;HGVSP=p.H1047R... GT:AD:DP  0/1:81,29:110     0/0
```

Two conventions affect how to read the matrix:

- `0/0` marks a site the caller did not call, since a MAF has no coverage record
  for one
- every somatic call is written het, because a MAF gives no ploidy

Read counts are kept in `AD`/`DP`. `INFO/CSQ` re-encodes the VEP columns from
the MAF (`Consequence`, `IMPACT`, `HGVSp_Short`, SIFT, PolyPhen), so the track
can color cells by consequence impact without running an annotator.

The clinical TSV is one row per tumor barcode and one column per attribute:

```text
name              histology  er        pr        her2      subtype    stage
TCGA-3C-AAAU-01A  lobular    positive  positive  negative  HR+/HER2-  X
```

Its columns come from three places:

- `histology` and `stage` are the GDC's harmonized case fields
- `er`/`pr`/`her2` are read from each case's clinical XML, with in-situ
  hybridization taking precedence over immunohistochemistry for HER2
- `subtype` is derived from those three; a tumor whose receptor calls do not
  resolve it stays `unknown`

The table lists more tumors than the mutation track draws.[^unmatched]

## Load the cohort VCF into JBrowse

Add the assembly first. The hosted FASTA calls its contigs bare (`1`) while the
VCF uses `chr1`, so pass the alias file and both resolve.

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

The cohort is a `VariantTrack` whose adapter reads the clinical TSV, shown in
the multi-sample matrix display:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "tcga_brca_mutations",
  "name": "TCGA-BRCA somatic mutations (979 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "variantLayout": "columns",
      "height": 1010,
      "color": { "field": "impact" }
    }
  ]
}
```

The track config sets three things:

- [`variantLayout: 'columns'`](/docs/user_guides/multivariant_track#matrix-best-for-snpindel-patterns)
  uses one column per mutation, so a gene's mutations pack together however far
  apart they sit, with a connector band from each column to its position
- [`color`](/docs/config/linearmultisamplevariantdisplay/#slot-color) set to the
  `impact` field colors each cell by its VEP impact tier from `CSQ`, the same as
  **Color by... → Consequence impact** in the track menu
- [`samplesTsvLocation`](/docs/config/vcftabixadapter/#slot-samplestsvlocation)
  makes the clinical columns available to group and color rows by

The display divides
[`height`](/docs/config/linearmultisamplevariantdisplay/#slot-height) among the
rows, so each row is about a pixel tall and a band's mutation density shows as
its darkness.

## Group the rows by clinical annotation

[`facet`](/docs/config/linearmultisamplevariantdisplay/#slot-facet) names a
column of the samples TSV and makes each of its values a contiguous band of
rows, sorted; its `domain` pins the bands you want first.
[`rowColor`](/docs/config/linearmultisamplevariantdisplay/#slot-rowcolor) puts
the matching color strip in the gutter. Both have a track-menu row too: **Group
by...** and **Color by... → Samples**.

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "tcga_brca_mutations",
  "name": "TCGA-BRCA somatic mutations (979 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "variantLayout": "columns",
      "height": 450,
      "lineZoneHeight": 130,
      "color": { "field": "impact" },
      "facet": { "field": "histology", "domain": ["ductal", "lobular"] },
      "rowColor": "histology"
    }
  ]
}
```

Open the matrix over _CDH1_'s exons: right-click _CDH1_ in the gene lane, choose
**Collapse introns**, and **Replace current view** (see
[](/docs/user_guides/gene_track)):

<Video src="/media/tcga/mutations_collapse_introns.mp4" caption="The whole CDH1 transcript reshaped to its exons from the gene's context menu, and the 979-tumor matrix redrawn over the coding sequence." />

<Figure caption="CDH1's exons (introns collapsed), rows grouped and colored by histology, cells colored by VEP impact. The truncating (HIGH impact) cells crowd into the lobular band and the much larger ductal band above it is nearly empty." src="/img/tcga/mutations_cdh1_histology.png" />

Loss of E-cadherin, the protein _CDH1_ encodes, is the defining lesion of
lobular breast cancer
([Ciriello et al. 2015](https://doi.org/10.1016/j.cell.2015.09.033)).

The GDC's open mutation calls cover the exome only, so every figure here is
gene-scale.

## Group rows by receptor subtype

Setting `facet` and `rowColor` to `subtype` instead bands the rows by receptor
status ([TCGA 2012](https://doi.org/10.1038/nature11412)), with the HR+/HER2-
band first in `domain`:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "tcga_brca_mutations",
  "name": "TCGA-BRCA somatic mutations (979 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_mutations.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "variantLayout": "columns",
      "height": 450,
      "lineZoneHeight": 130,
      "color": { "field": "impact" },
      "facet": {
        "field": "subtype",
        "domain": ["HR+/HER2-", "HER2+", "triple-negative"]
      },
      "rowColor": "subtype"
    }
  ]
}
```

The bottom band is the tumors whose receptor calls do not resolve a subtype.

With its introns collapsed the same way, _PIK3CA_ shows its calls piled on three
columns: H1047R in the kinase domain, and E542K and E545K side by side in the
helical domain. All three run through every band, densest in HR+/HER2-.

<Figure caption="PIK3CA's exons (introns collapsed), rows banded and colored by receptor subtype. Three columns, two in the helical domain and one in the kinase domain, hold most of the cohort's calls, against the private columns spread around them." src="/img/tcga/mutations_pik3ca_grouped.png" />

The
[copy-number cohort](/docs/tutorials/tcga_cohort_cnv#split-the-recurrence-by-clinical-group)
splits its gain and loss frequency by the same clinical TSV, so its subtype rows
line up with these bands.

## Add a track of mutation frequency per gene

The bands above differ in height, so their darkness does not compare as a rate.
[`mutation_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mutation_recurrence.py)
writes one interval per gene, valued as the percent of each group with a
mutation. It takes the same `SAMPLES.tsv:COLUMN` group spec as the copy-number
cohort's
[`cnv_recurrence.py`](/docs/tutorials/tcga_cohort_cnv#add-a-recurrence-track):

<!-- from: scripts/build_tcga_cohort_mutations.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mutation_recurrence.py
python3 mutation_recurrence.py tcga_brca_mutations.vcf.gz by_subtype.bedGraph \
  --groups tcga_brca_clinical.tsv:subtype
```

```text
#chrom  start      end        HR+/HER2-  HER2+  triple-negative  unknown
chr3    179199065  179234302  40.56      30.18  11.19            30.71
chr17   7670683    7676564    19.44      39.64  80.42            32.28
```

`BedGraphTabixAdapter` takes every column past `end` as a separate signal, and a
[`MultiQuantitativeTrack`](/docs/config_guides/quantitative_track) draws one row
per group.

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "tcga_brca_mutation_recurrence_by_subtype",
  "name": "TCGA-BRCA mutation recurrence by receptor subtype",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedGraphTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_mutation_recurrence_by_subtype.bedGraph.gz"
  },
  "displayDefaults": {
    "height": 260,
    "scales": { "y": { "domainMin": 0, "domainMax": 100 } },
    "showRowSeparators": true
  }
}
```

Open the track above the matrix to read each band's rate over it.

`--impact` sets what counts as a hit, defaulting to the HIGH and MODERATE tiers
of the consequence impact that colours the matrix. The rate has no background
model, and gene length enters directly: _TTN_, a very long gene, ranks near the
top on passenger mutations alone.

On the matrix, **Clustering → Cluster rows by genotype...** gathers every
mutated sample into one block (see [](/docs/user_guides/clustering)), and
**Filter by... → Minor allele frequency** keeps the recurrent mutations (see
[filtering by allele frequency and missingness](/docs/user_guides/multivariant_track#filtering-by-allele-frequency-and-missingness)).

## Use your own cohort

[`maf_to_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_vcf.py)
takes any directory of MAFs ([vcf2maf](https://github.com/mskcc/vcf2maf) output,
cBioPortal study downloads, your own caller) whose rows have `Chromosome`,
`Start_Position`, the two allele columns, `Tumor_Sample_Barcode`, and `CONTEXT`.
A cohort that never passed through a MAF needs a multi-sample somatic VCF. For
grouping, any TSV whose first column matches the VCF's sample names works.

## Reproduce it end to end

One script builds every file above for any project id,
[`build_tcga_cohort_mutations.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_mutations.sh):

1. It downloads every open-access **Masked Somatic Mutation** MAF in the
   project, the GDC's aliquot-merged ensemble calls with germline sites masked
   out, which need no dbGaP application.
2. [`maf_to_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_vcf.py)
   merges them into one VCF, a column per tumor. A GDC file query also returns
   metastasis MAFs, so the merge keeps primary tumors (sample-type code `01` in
   each MAF's barcode), the tumors the
   [copy-number cohort](/docs/tutorials/tcga_cohort_cnv) paints. It keeps one
   aliquot per tumor, names each column by sample barcode as the copy-number
   rows are named, and reads each deletion's anchor base from the MAF's
   `CONTEXT` column, so it needs no reference FASTA.
3. [`tcga_clinical_tsv.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/tcga_clinical_tsv.py)
   builds the [clinical table](#what-the-two-files-hold).
4. [`mutation_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mutation_recurrence.py)
   writes, per gene and group, the share of tumors with at least one call in the
   `--impact` tiers. A tumor counts once however many calls it has in the gene.

It needs `curl`, `python3`, and `bgzip` + `tabix` from
[htslib](http://www.htslib.org/), which on Debian/Ubuntu is
`apt install curl python3 tabix`.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_tcga_cohort_mutations.sh
bash build_tcga_cohort_mutations.sh TCGA-BRCA 20 # 20 tumors, to test the pipeline
bash build_tcga_cohort_mutations.sh TCGA-BRCA    # the full cohort, ~10 minutes
npx --yes serve jbrowse2                         # then open the printed URL
```

The script writes a `jbrowse2/` opening on _PIK3CA_ with the recurrence rows
over the matrix.

Swap in any other project id (`TCGA-LUAD`, `TCGA-COAD`, ...) for a different
cohort, with `--no-receptors` to `tcga_clinical_tsv.py` for a non-breast
project. A third argument names the clinical column the recurrence track splits
on; `subtype` is breast only, while `histology` and `stage` work for any
project.

## See also

- [](/docs/user_guides/multivariant_track)
- [](/docs/config_guides/variant_track)
- [](/docs/user_guides/clustering)
- [](/docs/tutorials/tcga_cohort_cnv)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/config_guides/jexl)

## External links

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC MAF format](https://docs.gdc.cancer.gov/Data/File_Formats/MAF_Format/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)

[^unmatched]:
    A case with no mutation calls still has receptor status. JBrowse reports the
    unmatched tumors when the track loads.
