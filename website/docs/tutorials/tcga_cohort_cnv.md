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

We use TCGA-BRCA (breast invasive carcinoma), which gives about 1100 primary
tumors. The whole cohort is a few MB of segment calls, so this needs no
alignments and no special hardware.

Everything here is **open-access** GDC data. No dbGaP application, no token, no
controlled-access request. That is the part that makes this tutorial
reproducible, so it is worth knowing exactly which tier the data sits in before
we start.

## What you need

- [JBrowse CLI](/docs/cli) (`@jbrowse/cli`)
- `curl` and `python3`
- `bgzip` and `tabix` (from [htslib](http://www.htslib.org/))
- About 2 GB of temporary disk space, and roughly 15 minutes

## Which TCGA data is open

The GDC splits TCGA into two access tiers, and the difference decides what a
tutorial like this can use:

- **Controlled access** needs a dbGaP application: raw sequence (BAM/CRAM),
  germline variant calls, anything from which an individual could be
  re-identified.
- **Open access** needs nothing at all: the derived, summarized calls. That
  includes the copy-number segment files we want here.

The file type is **Masked Copy Number Segment**. It comes from Affymetrix SNP
6.0 arrays, GDC has already harmonized it to GRCh38, and the "masked" part means
GDC has removed probes overlapping known germline CNVs, so what remains is
somatic.

Each file is a small tab-separated table, one row per segment:

```
GDC_Aliquot                           Chromosome  Start     End        Num_Probes  Segment_Mean
cdcbf3a0-b1eb-4a63-b669-f7a6438c6902  1           3301765   97332922   54808       -0.011
cdcbf3a0-b1eb-4a63-b669-f7a6438c6902  1           97337299  97338168   3           -1.2888
```

`Segment_Mean` is the caller's log2 ratio of tumor to normal. Zero is balanced,
negative is loss, positive is gain. We carry that number through to JBrowse
unchanged.

## Find the files

The GDC API takes a JSON filter and hands back matching file ids. We ask for one
project, the masked segment files, and only primary tumors. That last filter
matters: TCGA also banks a matched blood normal per case, which would double the
file count and contribute no somatic signal.

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
    "format": "JSON",
    "size": "20000"
  }' > manifest.json
```

Two fields come back per hit, and we need both: `file_id` to download it, and
`cases.samples.submitter_id` for the TCGA barcode (`TCGA-3C-AAAU-01A`), which
becomes the row label in the finished track.

Swap `TCGA-BRCA` for any other project id to build a different cohort. TCGA-OV
(ovarian) is smaller and more dramatically aneuploid; TCGA-LUAD (lung
adenocarcinoma) sits in between.

## Download the segments

Do not fetch 1106 files one at a time. The GDC `/data` endpoint accepts a POST
with many ids and streams back a single `.tar.gz`, so the whole cohort arrives
in a handful of requests:

```bash
# ids for one batch, as JSON: {"ids": ["...", "..."]}
curl -s 'https://api.gdc.cancer.gov/data' \
  -H 'Content-Type: application/json' \
  -d @batch.json \
  | tar xz -C seg/
```

Unpack **without** `--strip-components`. The archive is laid out as
`<file_id>/<name>.seg.txt`, and that directory name is the only thing tying each
file back to its barcode in `manifest.json`.

Batches of about 150 ids work well. The server builds each archive before it
streams, so very large batches just stall.

## Reshape into one BED

This is the only real data-wrangling step, and it is deliberately dull:
concatenate every sample's segments and tag each row with its barcode. No
re-normalization, no re-calling. JBrowse plots what the caller called.

Three small corrections are needed on the way:

- `.seg` uses bare contig names (`1`), but the hg38 assembly's refNames are
  `chr`-prefixed, so we add `chr`.
- `.seg` Start is 1-based and inclusive; BED start is 0-based and half-open, so
  we subtract 1.
- A couple of cases carry **replicate aliquots**: two array runs of the same
  tumor, and so two files sharing one barcode. Left alone they land in the same
  row and paint overlapping segments on top of each other, so keep one file per
  barcode. In TCGA-BRCA this drops 2 of the 1106 files, leaving 1104 tumors.

The result is a BED whose `#`-prefixed header names the extra columns:

```
#chrom  start     end        name    sample             segmean
chr1    3301764   97332922   -0.01   TCGA-3C-AAAU-01A   -0.0110
chr1    97337298  97338168   -1.29   TCGA-3C-AAAU-01A   -1.2888
```

`sample` is what splits the rows, and `segmean` is what colors them.
`scripts/build_tcga_cohort_cnv.sh` does the whole loop; see
[Reproduce it end to end](#reproduce-it-end-to-end).

Then compress and index it the usual way (see
[adding tracks](/docs/quickstart_web#adding-tracks) for more on this step):

```bash
bgzip tcga_brca_cnv.bed
tabix -p bed tcga_brca_cnv.bed.gz
```

For TCGA-BRCA that comes to 379,318 segments across 1104 tumors, and the
compressed file is about 5.7 MB.

## Load the reference and the track

```bash
export OUT=/var/www/html/jbrowse2
jbrowse add-assembly hg38.fa --out $OUT --load copy
```

Then add the cohort track. This one needs a hand-written config rather than
`add-track`, because the display does the interesting part:

```json
{
  "type": "FeatureTrack",
  "trackId": "tcga_brca_cnv",
  "name": "TCGA-BRCA copy number (1104 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": { "uri": "tcga_brca_cnv.bed.gz" },
    "index": { "location": { "uri": "tcga_brca_cnv.bed.gz.tbi" } }
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "tcga_brca_cnv-LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "rowHeight": 0,
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

The four settings doing the work:

- [`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
  splits the one file into one labeled row per `sample`. A thousand barcodes
  gives a thousand rows.
- [`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight) of
  `0` means auto-fit: the display height is divided evenly across the rows, with
  a 1px floor. At this row count every sample is a single pixel line, which is
  exactly what you want, since the pattern lives in the stack rather than in any
  one row.
- [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) is a
  [jexl](/docs/config_guides/jexl) expression binning `segmean` onto a diverging
  blue-to-red scale. Other multi-row tutorials skip this because their BED
  carries `itemRgb`; here the color has to be derived from a number, so the
  expression is the color.
- [`legend`](/docs/config/linearmultirowfeaturedisplay/#slot-legend) spells the
  scale out, since a reader cannot infer the log2 cutoffs from the picture.

## Read it

Open the track at whole-genome zoom and turn on the cluster tree from the track
menu ("Show tree"). Clustering reorders the rows so tumors with similar
copy-number profiles sit together, which turns a noisy stack into blocks.

What to look for:

- **Vertical blue stripes** are recurrent deletions. The clearest are 9p21
  (CDKN2A) and 10q23 (PTEN), both classic tumor suppressors.
- **Vertical red stripes** are recurrent amplifications: 17q12 (ERBB2, the HER2
  of HER2-positive breast cancer), 8q24 (MYC), and 11q13 (CCND1).
- **Whole rows that are mostly red or mostly blue** are heavily aneuploid
  tumors. Clustering pulls these together, so they read as a band rather than
  scattered noise.

The single-tumor tutorials show you _that_ a locus is altered in one sample.
This view shows you _how often_ it is altered across a disease, which is the
question a cohort is there to answer.

## Reproduce it end to end

[`build_tcga_cohort_cnv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_cnv.sh)
runs every step above, from the API query to the indexed BED:

```bash
bash scripts/build_tcga_cohort_cnv.sh TCGA-BRCA
# -> tcga_brca_cnv.bed.gz (+ .tbi)
```

Pass a second argument to build a small cohort first, which is a good way to
check the pipeline before committing to the full download:

```bash
bash scripts/build_tcga_cohort_cnv.sh TCGA-BRCA 20
```

## See also

- [BXD QTL mapping](/docs/tutorials/bxd_qtl), which uses the same multi-row
  display for strain genotypes
- [ChromHMM chromatin states](/docs/tutorials/chromhmm), the same display across
  cell types
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab), single-tumor
  structural and copy-number variation
- [jexl](/docs/config_guides/jexl)

## References

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC API documentation](https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)
