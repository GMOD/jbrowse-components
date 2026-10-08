---
title: CNV cohort (TCGA)
description:
  Plot somatic copy number across a thousand tumors, one row per sample
guide_category: Tutorials
tutorial_category: Cancer genomics
---

Tumors from different patients tend to gain and lose the same regions, because
those regions contain a gene driving the cancer. We stack copy-number segment
calls for 1104 TCGA breast tumors, one row per tumor colored by gain or loss, so
a recurrent event reads as a vertical stripe down the stack.

## Prerequisites

- a JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop)) and the
  [JBrowse CLI](/docs/cli)

## Where the data comes from

TCGA-BRCA, from the GDC's open-access **Masked Copy Number Segment** files
(Affymetrix SNP 6.0, harmonized to GRCh38), so no dbGaP application or token is
needed.

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

- primary-tumor segment calls for 1104 tumors, queried and downloaded through
  the GDC API: https://api.gdc.cancer.gov/files
- per-tumor clinical annotation, from harmonized case fields and each case's
  clinical XML: https://api.gdc.cancer.gov/cases

The build script copies the hg38 reference and the MANE gene track from the
[hosted UCSC hg38 hub](https://genomes.jbrowse.org/ucsc/hg38/)'s config, so it
downloads no reference; the assembly fence below loads GRCh38 from jbrowse.org
instead.

## The segment BED format, one call per line

The segment BED holds one copy-number call per line, with a `#`-prefixed header
naming the columns past `end`.
[Reproduce it end to end](#reproduce-it-end-to-end) builds it from the GDC.

```text
#chrom  start     end        name    sample             segmean
chr1    3301764   30796057   +0.15   TCGA-3C-AAAU-01A   0.1480
chr1    3301764   7589655    -0.98   TCGA-3C-AALI-01A   -0.9761
```

`sample` is a TCGA barcode and splits the rows; `segmean` is the caller's log2
tumor/normal ratio and colors them.

## Load the segments into JBrowse

Add the assembly first. The hosted FASTA names its contigs `1`, `2`, ... and the
BED uses `chr1`, so pass the alias file to map one onto the other.

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

The segments themselves are a `FeatureTrack` whose
`LinearMultiRowFeatureDisplay` holds the row and color settings:

```json addtrack config=test_data/tcga_cnv/config.json loc=17:39,000,000-40,500,000
{
  "type": "FeatureTrack",
  "trackId": "tcga_brca_cnv",
  "name": "TCGA-BRCA copy number (1104 primary tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": "sample",
      "color": {
        "field": "segmean",
        "scale": "threshold",
        "domain": ["-1", "-0.3", "0.3", "1"],
        "range": ["#2166ac", "#92c5de", "#f7f7f7", "#f4a582", "#b2182b"],
        "labels": [
          "Deep loss (log2 < -1)",
          "Loss",
          "Balanced",
          "Gain",
          "Amplification (log2 > 1)"
        ],
        "title": "Copy number (log2)"
      }
    }
  ]
}
```

[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight)
auto-fits, which at this row count makes each tumor under a pixel tall. Two
settings do the rest:

- [`rows`](/docs/config/linearmultirowfeaturedisplay/#slot-rows) splits the file
  into one labeled row per `sample`
- [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) bins
  `segmean` onto a diverging blue-to-red scale at four cut points, since this
  BED has no `itemRgb`, and `labels` names each bin in the key

## Cluster tumors by copy-number profile

Open the track over _ERBB2_ and choose **Clustering → Cluster rows by
similarity...** from the track menu (see [](/docs/user_guides/clustering)).
JBrowse averages `segmean` across each bin in view and sorts the rows into
blocks with a shared copy-number profile, so the tumors amplified at _ERBB2_
gather into one band.

Clustered at whole-genome zoom, the stack groups tumors by their genome-wide
profile, and the heavily aneuploid tumors, whose rows run red or blue end to
end, form a band of their own.

<Video src="/media/tcga/cohort_cnv_clustering.mp4" caption="The ERBB2 window, clustered from the track menu: 1104 tumors in barcode order, the Clustering item, and the bands the run leaves behind." />

<Figure caption="Copy-number segments around ERBB2 (highlighted), one row per tumor, clustered on this window. The rows sort into amplified, gained, lost and balanced bands, and the amplified tumors' gain thins out on either side of the gene." src="/img/tcga/cohort_cnv_erbb2.png" />

## Add a track of gain and loss frequency {#add-a-recurrence-track}

Each 100 kb bin of `tcga_brca_cnv_recurrence.bedGraph.gz` has the percent of the
cohort gained and the percent lost, on the same log2 cutoffs the stack colors by
(gain above 0.3, loss below -0.3):

```text
#chrom  start      end        gain   loss
chr1    204700000  204800000  58.88  -1.36
chr8    127600000  127800000  49.73  -0.91
chr16   89200000   89300000   3.26   -46.38
```

`BedGraphTabixAdapter` reads every column past `end` as a separate signal. Loss
is written negative so a wiggle cutting its colour at the default `origin` of 0
draws gains up in one colour and losses down in the other.

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "tcga_brca_cnv_recurrence",
  "name": "TCGA-BRCA recurrence (% of 1104 tumors)",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedGraphTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence.bedGraph.gz"
  },
  "displayDefaults": {
    "height": 120,
    "color": {
      "field": "score",
      "scale": "threshold",
      "range": ["#2166ac", "#b2182b"]
    },
    "scales": { "y": { "domainMin": -100, "domainMax": 100 } }
  }
}
```

`scales.y`'s `domainMin` and `domainMax`
([display options](/docs/config_guides/quantitative_track#display-options)) pin
the axis, so a bar means the same fraction wherever you navigate. Place the
track above the stack, so that each peak sits over a stripe:

<Figure caption="Gain and loss frequency per 100 kb (bars up for gain, down for loss) above the copy-number stack of all primary tumors, one row per tumor, clustered by profile. Recurrent events read as vertical stripes through the stack." src="/img/tcga/cohort_cnv_genome.png" />

## Split gain and loss frequency by clinical group {#split-the-recurrence-by-clinical-group}

`cnv_recurrence.py --groups` runs the same tally once per value of a clinical
column, such as tumor subtype, and writes a gain and a loss column per group:

<!-- from: scripts/build_tcga_cohort_cnv.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/cnv_recurrence.py
python3 cnv_recurrence.py tcga_brca_cnv.bed.gz by_subtype.bedGraph \
  --groups tcga_brca_clinical.tsv:subtype
```

The `--groups` file is the
[clinical TSV](/docs/tutorials/tcga_cohort_mutations#what-the-two-files-hold)
the mutation cohort also uses. Four subtypes give eight signals, each named for
its subtype and direction, with losses stored below zero. We'll draw them on a
[mark display](/docs/config_guides/mark_display), one row per subtype with its
gain above the line and its loss below. A `formula` step reads the subtype off
each signal's column name:

```json addtrack config=test_data/tcga_cnv/config.json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "tcga_brca_cnv_recurrence_by_subtype",
  "name": "TCGA-BRCA recurrence by receptor subtype",
  "assemblyNames": ["hg38"],
  "category": ["TCGA"],
  "adapter": {
    "type": "BedGraphTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence_by_subtype.bedGraph.gz"
  },
  "displays": [
    {
      "type": "LinearMarkDisplay",
      "height": 500,
      "transform": [
        {
          "type": "formula",
          "expr": "jexl:replace(replace(feature.source, ' gain', ''), ' loss', '')",
          "as": "subtype"
        }
      ],
      "rows": {
        "field": "subtype",
        "domain": ["HR+/HER2-", "HER2+", "triple-negative", "unknown"]
      },
      "scales": {
        "y": { "domainMin": -70, "domainMax": 70, "title": "% of tumors" }
      },
      "marks": [
        {
          "mark": "bar",
          "encoding": {
            "y": "score",
            "color": {
              "field": "score",
              "scale": "threshold",
              "domain": [0],
              "range": ["#2166ac", "#b2182b"],
              "labels": ["loss", "gain"],
              "title": "Copy number call"
            }
          }
        }
      ]
    }
  ]
}
```

On a track already open, **Display types → Marks** draws one row per column and
**Edit plot...** adds the step and the rows. The bottom row is the tumors whose
receptor calls do not resolve a subtype.

<Figure caption="Gain and loss frequency per 100 kb (bars up for gain, down for loss) across the 22 autosomes and chrX, one row per receptor subtype. 17q gain is confined to the HER2+ row, 5q loss and 10p gain to the triple-negative row; 1q and 8q gain are in every row." src="/img/tcga/cohort_cnv_recurrence_subtype.png" />

The file keeps gain and loss as separate columns, since at the edge of the 17q
amplicon the HER2+ group is gained and lost at nearly the same rate, and its row
draws both.

Two options adjust the split:

- `--min-group` sets how many tumors a subtype needs before it is plotted, and
  the script names each group it dropped.
- `--groups` takes any other column for a different split: `histology` and
  `stage` work for any TCGA project, while `subtype` is breast specific.

## Use your own cohort

Any caller that writes per-sample segments works. Reshape its output into a BED
with a sample column and a numeric column to colour by, one segment per line:

```text
#chrom  start      end        name   sample    segmean
chr1    1000000    2500000    +0.42  tumor_01  0.42
chr1    1000000    8000000    -0.75  tumor_02  -0.75
chr8    127000000  128500000  +1.30  tumor_01  1.30
```

[CNVkit](https://cnvkit.readthedocs.io/) `.call.cns`, ASCAT and
[PURPLE](https://github.com/hartwigmedical/hmftools/tree/master/purple) segments
all reshape into this by concatenating the per-sample files with the sample name
added as a column. Sort, compress and index the result:

```bash
jbrowse sort-bed cohort.bed | bgzip > cohort.bed.gz
tabix cohort.bed.gz
```

Add the segment track config from
[Load the segments into JBrowse](#load-the-segments-into-jbrowse) with `uri`
pointing at `cohort.bed.gz`.

## Reproduce it end to end

One script builds every file above for any project id,
[`build_tcga_cohort_cnv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_cnv.sh):

1. It asks the GDC for the project's open-access **Masked Copy Number Segment**
   files (Affymetrix SNP 6.0, GRCh38, germline CNV probes removed), which need
   no dbGaP application, from primary tumors only, so the matched normals stay
   out of the stack.
2. It keeps one file per tumor barcode, so a tumor run twice on the array does
   not draw two overlapping sets of segments in one row.
3. It joins every tumor's segments into one BED with the barcode as `sample`,
   adding `chr` to the contig names and moving the 1-based `.seg` starts to
   BED's 0-based ones. `Segment_Mean` passes through unchanged, so each row's
   colour is the caller's own log2 ratio.
4. [`cnv_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/cnv_recurrence.py)
   tallies the gained and lost share of the cohort per 100 kb bin, pooled and
   per clinical group. A tumor counts in a bin when its segment covers the bin's
   midpoint. Bins where fewer than half the tumors have any call are left out,
   so a gap in the track is missing data.

It needs `curl`, `python3`, and `bgzip` + `tabix` from
[htslib](http://www.htslib.org/), which on Debian/Ubuntu is
`apt install curl python3 tabix`.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_tcga_cohort_cnv.sh
bash build_tcga_cohort_cnv.sh TCGA-BRCA 20 # 20 tumors, to test the pipeline
bash build_tcga_cohort_cnv.sh TCGA-BRCA    # the full cohort, ~20 minutes
npx --yes serve jbrowse2                   # then open the printed URL
```

The script writes a `jbrowse2/` opening on _ERBB2_. Swap in any other project id
(`TCGA-OV`, `TCGA-LUAD`, ...), with a third argument to group the recurrence by
a different clinical column.

You can run `cnv_recurrence.py` alone on a cohort BED. The clinical table comes
from
[`tcga_clinical_tsv.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/tcga_clinical_tsv.py),
shared with the [mutation cohort](/docs/tutorials/tcga_cohort_mutations).

## See also

- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/tutorials/tcga_cohort_mutations)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/population_cnv)
- [](/docs/tutorials/alu_age)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/config_guides/jexl)

## External links

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC API documentation](https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)
