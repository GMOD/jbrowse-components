---
title: CNV cohort (TCGA)
description:
  Plot somatic copy number across a thousand tumors, one row per sample
guide_category: Tutorials
tutorial_category: Cancer genomics
data: download
---

**TL;DR:** tumors from different patients tend to gain and lose the same
regions, because those regions carry a gene driving the cancer. We stack
copy-number segment calls for 1104 TCGA breast tumors, one row per tumor colored
by gain or loss, so a recurrent event reads as a vertical stripe down the stack.

## Prerequisites

- A JBrowse 2 instance to add tracks to (see the
  [web quickstart](/docs/quickstart_web), or the
  [desktop quickstart](/docs/quickstart_desktop), which loads these tracks by
  URL with nothing to host) and the [JBrowse CLI](/docs/cli)
- These files, hosted; the whole 1104-tumor cohort is a few MB of segment calls:

| File                                                                             | What                              |
| -------------------------------------------------------------------------------- | --------------------------------- |
| `https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz`                            | the segment stack                 |
| `https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence.bedGraph.gz`            | cohort gain/loss frequencies      |
| `https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence_by_subtype.bedGraph.gz` | the same, split by clinical group |
| `https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv`                          | per-tumor histology, receptors    |

## Where the data comes from

TCGA-BRCA, from the GDC's open-access **Masked Copy Number Segment** files
(Affymetrix SNP 6.0, harmonized to GRCh38), so no dbGaP application or token is
needed.

- primary-tumor segment calls for 1104 tumors, queried and downloaded through
  the GDC API: https://api.gdc.cancer.gov/files
- per-tumor clinical annotation, from harmonized case fields and each case's
  clinical XML: https://api.gdc.cancer.gov/cases
- the segment stack, rehosted so the figures and their live links load without
  the GDC round trip: https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz
- the cohort recurrence track and the same split by clinical group:
  https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence.bedGraph.gz and
  https://jbrowse.org/demos/tcga/tcga_brca_cnv_recurrence_by_subtype.bedGraph.gz
- the clinical table the stack is grouped by:
  https://jbrowse.org/demos/tcga/tcga_brca_clinical.tsv

The hg38 reference and gene track beside them are the hosted UCSC
[hub](/docs/user_guides/hub_url)'s own entries.

## What the files hold

[Reproduce it end to end](#reproduce-it-end-to-end) below builds these files
from the GDC for any project id.

The BED is one segment call per line, with a `#`-prefixed header naming the
columns past `end`:

```
#chrom  start     end        name    sample             segmean
chr1    3301764   30796057   +0.15   TCGA-3C-AAAU-01A   0.1480
chr1    3301764   7589655    -0.98   TCGA-3C-AALI-01A   -0.9761
```

`sample` is a TCGA barcode and is what splits the rows; `segmean` is the
caller's log2 tumor/normal ratio and is what colors them.

Every primary tumor in the project stacks as its own row, so a copy-number
change shared across the cohort reads as a vertical stripe running down hundreds
of samples.

## Load the segments into JBrowse

Two commands set the whole thing up, an assembly and a track. Start with hg38,
where the one thing to watch is naming: the hosted FASTA calls its contigs bare
(`1`) while the BED uses `chr1`, so pass the alias file alongside it and both
resolve.

```bash
export OUT=/var/www/html/jbrowse2

jbrowse add-assembly https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz \
  --name hg38 --type bgzipFasta \
  --refNameAliases https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt \
  --out $OUT
```

The track goes in as JSON rather than a second command line, since `add-track`'s
flags do not reach inside a display:

```json
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
      "partitionField": "sample",
      "color": "jexl:feature.segmean<-1?'#2166ac':feature.segmean<-0.3?'#92c5de':feature.segmean<0.3?'#f7f7f7':feature.segmean<1?'#f4a582':'#b2182b'",
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
[`rowHeight`](/docs/config/linearmultirowfeaturedisplay/#slot-rowheight)
auto-fits, which at this row count leaves every tumor a single pixel line. Three
settings do the rest:

- [`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
  splits the one file into one labeled row per `sample`. A thousand barcodes
  gives a thousand rows.
- [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) is a
  [jexl](/docs/config_guides/jexl) expression binning `segmean` onto a diverging
  blue-to-red scale, since this BED carries no `itemRgb`.
- [`legend`](/docs/config/linearmultirowfeaturedisplay/#slot-legend) names each
  bin's log2 cutoff and color.

## Cluster the stack

Open the track at whole-genome zoom, then run **Clustering → Cluster rows by
similarity** from the track menu (see [](/docs/user_guides/clustering)), which
turns a noisy stack of 1104 tumors into blocks of shared copy-number profile.

A vertical stripe is one locus called the same way across many rows, blue for
recurrent loss and red for recurrent gain. A whole row tending red or blue is
one heavily aneuploid tumor, and clustering pulls those rows together into a
band. Zooming to a single locus turns the stripe back into per-tumor calls, and
clustering on that window alone sorts the cohort into its copy-number classes
there.

<Video src="/media/tcga/cohort_cnv_clustering.mp4" caption="The ERBB2 window, clustered from the track menu: 1104 tumors in barcode order, the Clustering item, and the bands the run leaves behind." />

The stack starts in barcode order, which encodes nothing, so the sorted state is
the one every figure below is in.

<Figure caption="chr17:39.0-40.5 Mb, spanning ERBB2, with clustering run on this window alone: the 1104 rows sort into amplified, gained, lost and balanced bands. The same locus is one vertical stripe in the genome-wide figure below." src="/img/tcga/cohort_cnv_erbb2.png" />

At 1104 rows in a few hundred pixels each row is well under one pixel tall, so
rows alias together and the saturated colors crowd out the neutral ones. The
stack maps where the events are, and the track below counts how many rows carry
them.

## Add a recurrence track

The same calls collapsed to per-bin frequencies give that count its own axis.
Each 100 kb bin of `tcga_brca_cnv_recurrence.bedGraph.gz` carries the percent of
the cohort gained and the percent lost, on the same log2 cutoffs the stack
colors by (gain above 0.3, loss below -0.3), so a stripe and its peak count the
same tumors:

```
#chrom  start      end        gain   loss
chr1    204700000  204800000  58.88  -1.36
chr8    127600000  127800000  49.73  -0.91
chr16   89200000   89300000   3.26   -46.38
```

`BedGraphTabixAdapter` reads every column past `end` as its own signal, so one
file carries both. Loss is written negative so that a wiggle's `bicolorPivot` at
0 draws gains up in `posColor` and losses down in `negColor`.

```json
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
    "posColor": "#b2182b",
    "negColor": "#2166ac",
    "minScore": -100,
    "maxScore": 100
  }
}
```

`minScore` and `maxScore`
([display options](/docs/config_guides/quantitative_track#display-options)) pin
the axis to the whole cohort, so a bar means the same fraction wherever you
navigate. `posColor`/`negColor` reuse the stack's amplification and deep-loss
colors, so the two tracks agree by eye.

Placed above the stack, each peak sits over a stripe and puts a number on it:

<Figure caption="TCGA-BRCA copy number across all 1104 primary tumors, one 1px row per tumor, clustered by profile, under the cohort's own gain and loss frequency per 100 kb. Recurrent events read as vertical stripes through the stack." src="/img/tcga/cohort_cnv_genome.png" />

Each bar is the fraction of the cohort carrying a call past the cutoff. There is
no background model, no significance test and no peak calling, and amplitude
enters only through the gain/loss cutoff;
[GISTIC](https://doi.org/10.1186/gb-2011-12-4-r41) is the tool for the
significance test.

## Split the recurrence by clinical group

The recurrence track above pools every tumor into one average.
`cnv_recurrence.py --groups` runs the same tally once per value of a clinical
column and writes each group its own gain and loss column:

<!-- from: scripts/build_tcga_cohort_cnv.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/cnv_recurrence.py
python3 cnv_recurrence.py tcga_brca_cnv.bed.gz by_subtype.bedGraph \
  --groups tcga_brca_clinical.tsv:subtype
```

The `--groups` file is the same
[clinical TSV](/docs/tutorials/tcga_cohort_mutations#what-the-two-files-hold)
the mutation cohort groups its matrix rows by, so a tumor falls in the same
group in both tracks.

The eight columns arrive as eight signals from that one file, and a
[`MultiQuantitativeTrack`](/docs/config_guides/multiquantitative_track) draws
one row each:

```json
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
  "displayDefaults": {
    "height": 620,
    "posColor": "#b2182b",
    "negColor": "#2166ac",
    "minScore": -70,
    "maxScore": 70,
    "showRowSeparators": true
  }
}
```

Row order follows the file's column order, so the four gain rows come first, in
red, and the four loss rows under them, in blue. The bottom row of each block
holds the tumors whose receptor calls do not resolve a subtype.

<Figure caption="Gain and loss frequency per 100 kb across the 22 autosomes and chrX, tallied separately for each receptor subtype. 17q gain is confined to the HER2+ row, 5q loss and 10p gain to the triple-negative row; 1q and 8q gain are in every row." src="/img/tcga/cohort_cnv_recurrence_subtype.png" />

[`minScore`](/docs/config/multilinearwiggledisplay/#slot-minscore)/[`maxScore`](/docs/config/multilinearwiggledisplay/#slot-maxscore)
pin the rows to one axis so they read against each other, at 70 here where the
pooled track above uses 100, since each row only ever fills half its axis.

Gain and loss stay separate columns, since at the edge of the 17q amplicon the
HER2+ group is gained and lost at nearly the same rate.

`--min-group` sets how many tumors a subtype needs before it is plotted, since
at a handful of tumors a percentage moves in visible steps. The script names
each group it dropped and how big it was.

Point `--groups` at any other column for a different split; `histology` and
`stage` come from harmonized GDC fields and so work for any TCGA project, while
`subtype` is breast specific.

## Use your own cohort

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

The same one-row-per-sample pattern carries to other GDC open-access data:

- **Allele-specific copy number** (ASCAT, open access at the GDC) is the closest
  extension. It reports major and minor allele copy number separately, so it
  shows loss-of-heterozygosity: a copy-neutral LOH region is balanced by total
  copy number and has lost a parental allele. Same `.seg` shape, same display,
  only the coloring expression changes.
- **Methylation** (Beta Value arrays, open access) is probe-level with genomic
  coordinates, and loads the same way with beta as the color field.

Splice junction quantification is not open access at the GDC, so a cohort
splicing view needs controlled-access RNA-seq and a dbGaP application. For open
splicing data, look outside TCGA (GTEx and recount3 publish junction summaries).

## Reproduce it end to end

One script builds every file above for any project id:
[`build_tcga_cohort_cnv.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_cnv.sh),
which summarizes recurrence with
[`cnv_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/cnv_recurrence.py).
It needs `curl`, `python3`, and `bgzip` + `tabix` from
[htslib](http://www.htslib.org/), which on Debian/Ubuntu is
`apt install curl python3 tabix`.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_tcga_cohort_cnv.sh
bash build_tcga_cohort_cnv.sh TCGA-BRCA 20 # 20 tumors, to test the pipeline
bash build_tcga_cohort_cnv.sh TCGA-BRCA    # the full cohort, ~20 minutes
npx --yes serve jbrowse2                   # then open the printed URL
```

It writes `tcga_brca_cnv.bed.gz` (+ `.tbi`), the two recurrence bedGraphs (+
`.tbi`) and `tcga_brca_clinical.tsv`, then a `jbrowse2/` opening on _ERBB2_ with
both recurrence lanes over one row per tumor. The assembly is the hosted UCSC
hg38 hub's own entry copied in, so the reference is never downloaded.

The full run is almost entirely downloading. Swap in any other project id
(`TCGA-OV`, `TCGA-LUAD`, ...) for a different cohort, and pass a third argument
to group the recurrence by a different clinical column, since `subtype` is
breast specific.

Three of its steps decide whether the resulting track loads correctly:

- **Open-access files only.** The GDC's **Masked Copy Number Segment** files
  (Affymetrix SNP 6.0, already harmonized to GRCh38, germline CNV probes
  removed) need no dbGaP application. The query filters to `Primary Tumor`,
  leaving out each case's matched blood normal.
- **The `.seg` to BED reshape.** `.seg` names contigs bare (`1`), so the script
  adds the `chr` prefix, and `.seg` starts are 1-based inclusive against BED's
  0-based half-open, so it subtracts 1. It keeps one file per barcode, so a
  tumor's row is one aliquot's calls.
- **`Segment_Mean` is carried through unchanged.**

The recurrence step is separately runnable as
[`cnv_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/cnv_recurrence.py),
if you have a cohort BED already and want only the frequency file. It skips bins
where fewer than half the cohort has any call, which here trims only the
chromosome tips. That coverage mask is taken over the whole cohort even when
`--groups` is set, so the grouped file has the same gaps as the pooled one.

The clinical table comes from
[`tcga_clinical_tsv.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/tcga_clinical_tsv.py),
the same helper and the same arguments the
[mutation cohort](/docs/tutorials/tcga_cohort_mutations) uses, so one file
serves both tracks.

## See also

- [](/docs/user_guides/multirow_feature_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/tutorials/tcga_cohort_mutations)
- [](/docs/tutorials/bxd_qtl)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/population_cnv)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/config_guides/jexl)

## References

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC API documentation](https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)
