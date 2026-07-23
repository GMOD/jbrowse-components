---
title: Cohort copy number (TCGA)
description:
  Plot somatic copy number across a thousand tumors, one row per sample
guide_category: Tutorials
tutorial_category: Structural variation
---

Most copy-number views show one tumor at a time. This tutorial builds the other
kind: every primary tumor in a TCGA project stacked as its own row, so a
copy-number change shared across the cohort reads as a vertical stripe running
down hundreds of samples.

<Figure caption="TCGA-BRCA copy number across all 1104 primary tumors, one 1px row per tumor, clustered by profile. Blue is loss, red is gain, on the caller's log2 ratio. Recurrent events read as vertical stripes through the stack; whole rows tending red or blue are the heavily aneuploid tumors that clustering groups together." src="/img/tcga/cohort_cnv_genome.png" />

The data is **open-access** GDC data: no dbGaP application, no token. The whole
cohort is a few MB of segment calls, so there are no alignments to download and
nothing to recompute.

## What you need

- [JBrowse CLI](/docs/cli) (`@jbrowse/cli`)
- `curl`, `python3`, and `bgzip` + `tabix` (from
  [htslib](http://www.htslib.org/))
- A JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web))

## Build the cohort file

One script does the whole data pipeline:
[`build_tcga_cohort_cnv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_cnv.sh)
queries the GDC, downloads every sample's segments, and merges them into one
indexed BED.

```bash
bash scripts/build_tcga_cohort_cnv.sh TCGA-BRCA
# -> tcga_brca_cnv.bed.gz (+ .tbi)
```

Try a small cohort first to check the pipeline before committing to the full
download:

```bash
bash scripts/build_tcga_cohort_cnv.sh TCGA-BRCA 20
```

The full TCGA-BRCA run takes about 15 minutes, almost all of it downloading, and
produces 379,318 segments across 1104 tumors in a 5.7 MB file. Swap in any other
project id (`TCGA-OV`, `TCGA-LUAD`, ...) for a different cohort.

To skip the build entirely and just load the finished file, it is hosted at
`https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz`.

## What the script is doing

You do not need this section to follow the tutorial, but you do need it to adapt
the script to other GDC data.

**Which data is open.** The GDC splits TCGA into two tiers. Controlled access
needs a dbGaP application and covers raw sequence and germline calls. Open
access needs nothing and covers the derived, summarized calls, including the
**Masked Copy Number Segment** files used here. Those come from Affymetrix SNP
6.0 arrays, GDC has already harmonized them to GRCh38, and "masked" means probes
over known germline CNVs are removed, so what remains is somatic.

**Finding the files.** One API query returns every matching file id plus its
TCGA barcode. The `Primary Tumor` filter matters: TCGA also banks a matched
blood normal per case, which would double the file count and add no somatic
signal.

```bash
curl -s 'https://api.gdc.cancer.gov/files' \
  -H 'Content-Type: application/json' \
  -d '{
    "filters": {"op":"and","content":[
      {"op":"in","content":{"field":"cases.project.project_id","value":["TCGA-BRCA"]}},
      {"op":"in","content":{"field":"data_type","value":["Masked Copy Number Segment"]}},
      {"op":"in","content":{"field":"cases.samples.sample_type","value":["Primary Tumor"]}},
      {"op":"in","content":{"field":"access","value":["open"]}}
    ]},
    "fields": "file_id,cases.samples.submitter_id",
    "format": "JSON", "size": "20000"
  }'
```

**Downloading.** The script does not fetch a thousand files one at a time. The
GDC `/data` endpoint takes a POST of many ids and streams back one `.tar.gz`, so
the cohort arrives in a handful of requests, in batches of 150.

**Reshaping.** Each `.seg` file is a small table (`GDC_Aliquot`, `Chromosome`,
`Start`, `End`, `Num_Probes`, `Segment_Mean`). The script concatenates them,
tags each row with its barcode, and fixes three things along the way:

- `.seg` uses bare contig names (`1`), so it adds the `chr` prefix.
- `.seg` `Start` is 1-based inclusive; BED start is 0-based half-open, so it
  subtracts 1.
- A few cases carry **replicate aliquots**, two array runs sharing one barcode.
  Left alone they land in the same row and paint over each other, so it keeps
  one file per barcode. In TCGA-BRCA that drops 2 of 1106 files, leaving 1104
  tumors.

`Segment_Mean` is the caller's log2 tumor/normal ratio and is carried through
unchanged. JBrowse plots what the caller called; it does not re-normalize.

The result is a BED whose `#`-prefixed header names the extra columns:

```
#chrom  start     end        name    sample             segmean
chr1    3301764   30796057   +0.15   TCGA-3C-AAAU-01A   0.1480
chr1    3301764   7589655    -0.98   TCGA-3C-AALI-01A   -0.9761
```

`sample` is what splits the rows, `segmean` is what colors them.

## Load it into JBrowse

Add hg38. The hosted FASTA below names its contigs bare (`1`), while our BED
uses `chr1`, so pass the alias file too and both resolve:

```bash
export OUT=/var/www/html/jbrowse2

jbrowse add-assembly https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --name hg38 --type bgzipFasta \
  --refNameAliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --out $OUT
```

Then add the track. This one is hand-written rather than `jbrowse add-track`,
because the display config is the interesting part:

```json
{
  "type": "FeatureTrack",
  "trackId": "tcga_brca_cnv",
  "name": "TCGA-BRCA copy number (1104 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "tcga_brca_cnv.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "tcga_brca_cnv-LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "color": "jexl:get(feature,'segmean')<-1?'#2166ac':get(feature,'segmean')<-0.3?'#92c5de':get(feature,'segmean')<0.3?'#f7f7f7':get(feature,'segmean')<1?'#f4a582':'#b2182b'",
      "legend": [
        { "label": "Deep loss (log2 < -1)", "color": "#2166ac" },
        { "label": "Loss", "color": "#92c5de" },
        { "label": "Balanced", "color": "#f7f7f7" },
        { "label": "Gain", "color": "#f4a582" },
        { "label": "Amplification (log2 > 1)", "color": "#b2182b" }
      ]
    }
  ]
}
```

The adapter's `uri` shorthand resolves the `.tbi` beside the file, and
[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight) is left
at its auto-fit default, which divides the display height across the rows with a
1px floor: at this row count every tumor is a single pixel line, which is the
point, since the pattern lives in the stack rather than in any one row. That
leaves three settings to write:

- [`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
  splits the one file into one labeled row per `sample`. A thousand barcodes
  gives a thousand rows.
- [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) is a
  [jexl](/docs/config_guides/jexl) expression binning `segmean` onto a diverging
  blue-to-red scale. Other multi-row tutorials skip this because their BED
  carries `itemRgb`; here the color is derived from a number, so the expression
  is the color.
- [`legend`](/docs/config/linearmultirowfeaturedisplay/#slot-legend) spells the
  scale out, since a reader cannot infer the log2 cutoffs from the picture.

## Read it

Open the track at whole-genome zoom, then run **Track menu > Cluster rows by
similarity**. Clustering reorders the rows so tumors with similar profiles sit
together, which turns a noisy stack into blocks, and draws the dendrogram in the
sidebar (**Sidebar with tree and labels**, on by default).

- **Vertical blue stripes** are recurrent deletions, clearest at 9p21 (CDKN2A);
  10q23 (PTEN) is present but faint in this cohort.
- **Vertical red stripes** are recurrent amplifications: 17q12 (ERBB2), 8q24
  (MYC), 11q13 (CCND1).
- **Whole rows tending red or blue** are heavily aneuploid tumors, which
  clustering pulls together into a band.

Zooming to a single locus turns the stripe back into per-tumor calls, and
clustering on just that window sorts the cohort into its copy-number classes
there.

<Figure caption="chr17:39.0-40.5Mb, spanning ERBB2, across the same 1104 tumors with clustering run on this window alone. The cohort separates into bands from top to bottom: amplification (dark red), gain (salmon), loss (blue), and finally the balanced majority, which is near-white because neutral copy number is drawn near-white throughout. That pale lower band is tumors, not empty track. The same locus is one vertical stripe in the genome-wide view above." src="/img/tcga/cohort_cnv_erbb2.png" />

Read proportions off the data rather than off the picture. At 1104 rows in a few
hundred pixels each tumor is well under one pixel tall, so rows alias together
and the saturated colors crowd out the neutral ones: the figure is a faithful
map of _where_ events are, not of _how many_ tumors carry them. Computed from
the BED, ERBB2 itself is amplified (log2 > 1) in 114 of the 1104 tumors (10.3%),
gained in a further 108 (9.8%), balanced in 756 (68.5%), and lost in 126
(11.4%).

## Using your own cohort

Nothing here is TCGA-specific. Any caller that emits per-sample segments works;
the track config above only needs a BED with a sample column and a numeric
column to color by:

```
#chrom  start  end  name  sample  segmean
```

[CNVkit](https://cnvkit.readthedocs.io/) `.call.cns`, ASCAT, and
[PURPLE](https://github.com/hartwigmedical/hmftools/tree/master/purple) segments
all reshape into that shape with the same concatenate-and-tag step.

## Where to go next

The same one-row-per-sample pattern carries to other GDC open-access data.
Counts below are open files for TCGA-BRCA, checked against the API:

- **Allele-specific copy number** (ASCAT, 2257 files) is the closest extension.
  It reports major and minor allele copy number separately, so it shows
  loss-of-heterozygosity, which the plain segment file above cannot: a
  copy-neutral LOH region looks balanced by total copy number but has lost a
  parental allele.
- **Somatic mutations** (Masked Somatic Mutation MAF, 992 files) are point
  positions rather than segments. One row per tumor turns recurrent driver
  mutations into vertical alignments at a single base, the mutation counterpart
  to the CNV stripes here.
- **Methylation** (Beta Value arrays, 1238 files) is probe-level with genomic
  coordinates, and loads the same way with beta as the color field.

Note that **splice junction quantification is not open access** at the GDC, so a
cohort splicing view needs controlled-access RNA-seq and a dbGaP application.
For open splicing data, look outside TCGA (GTEx and recount3 publish junction
summaries).

## See also

- [BXD QTL mapping](/docs/tutorials/bxd_qtl), the same multi-row display for
  strain genotypes
- [ChromHMM chromatin states](/docs/tutorials/chromhmm), the same display across
  cell types
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab), single-tumor
  structural and copy-number variation
- [jexl](/docs/config_guides/jexl)

## References

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC API documentation](https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)
