---
title: CNV cohort (TCGA)
description:
  Plot somatic copy number across a thousand tumors, one row per sample
guide_category: Tutorials
tutorial_category: Cancer genomics
---

**TL;DR:** stack every tumor in a TCGA cohort as its own row of a
`LinearMultiRowFeatureDisplay`, partitioned by sample and colored by a jexl
expression on the segment log2 ratio, so recurrent copy-number events read as
vertical stripes down the stack.

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
| `https://jbrowse.org/demos/tcga/tcga_brca_cnv.zarr`                              | the same segments, binned         |

## What the files hold

Both come from open-access GDC data, so no dbGaP application and no token is
involved. [Reproduce it end to end](#reproduce-it-end-to-end) below builds them
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

Most copy-number views show one tumor at a time. This tutorial builds the other
kind: every primary tumor in a TCGA project stacked as its own row, so a
copy-number change shared across the cohort reads as a vertical stripe running
down hundreds of samples.

<Figure caption="TCGA-BRCA copy number across all 1104 primary tumors, one 1px row per tumor, clustered by profile, under the cohort's own gain (red, up) and loss (blue, down) frequency per 100kb. Recurrent events read as vertical stripes through the stack, each under a peak in the frequency track." src="/img/tcga/cohort_cnv_genome.png" />

## Load it into JBrowse

Add hg38. The hosted FASTA names its contigs bare (`1`) while the BED uses
`chr1`, so pass the alias file too and both resolve:

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

Open the track at whole-genome zoom, then run "Clustering > Cluster rows by
similarity" action in the track menu (see [](/docs/user_guides/clustering) for
the mechanic). Here, clustering turns a noisy stack of 1104 tumors into blocks
of shared copy-number profile.

A vertical stripe is one locus called the same way across many rows, blue for
recurrent loss and red for recurrent gain. A whole row tending red or blue is
one heavily aneuploid tumor, altered across most of its genome, and clustering
pulls those rows together into a band.

Zooming to a single locus turns the stripe back into per-tumor calls, and
clustering on just that window sorts the cohort into its copy-number classes
there.

<Figure caption="chr17:39.0-40.5Mb, spanning ERBB2, with clustering run on this window alone: the 1104 rows sort into amplified (dark red), gained (salmon), lost (blue) and balanced bands. The pale band is the balanced group, the largest of the four, drawn near-white rather than empty track. The same locus is one vertical stripe in the genome-wide figure above." src="/img/tcga/cohort_cnv_erbb2.png" />

Do not read proportions off this display. At 1104 rows in a few hundred pixels
each row is well under one pixel tall, so rows alias together and the saturated
colors crowd out the neutral ones, which leaves the balanced band drawn thinner
than its share of the file. The stack maps where events are rather than how many
rows carry them.

## Add a recurrence track

A second track fixes what the stack cannot: the same calls collapsed to per-bin
frequencies, so the count the stack blurs gets its own axis. Each 100kb bin of
`tcga_brca_cnv_recurrence.bedGraph.gz` carries the percent of the cohort gained
and the percent lost, on the same log2 cutoffs the stack colors by (gain above
0.3, loss below -0.3), so a stripe and its peak count the same tumors:

```
#chrom  start      end        gain   loss
chr1    204700000  204800000  58.88  -1.36
chr8    127600000  127800000  49.73  -0.91
chr16   89200000   89300000   3.26   -46.38
```

Two value columns, and `BedGraphTabixAdapter` reads every column past `end` as
its own signal, so one file carries both. Loss is written negative because a
wiggle's `bicolorPivot` sits at 0: gains then draw up in `posColor`, losses down
in `negColor`, and the track is the mirrored frequency plot without any of it
being a special mode.

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
navigate. Left to autoscale, a quiet window would rescale to its own noise and
read like a peak. `posColor`/`negColor` reuse the stack's amplification and
deep-loss colors, so the two tracks agree by eye.

Placed above the stack, as in the figure at the top of this page, each peak sits
over a stripe and puts a number on it: 1q gained in 58.9% of tumors at its peak,
16q lost in 46.4%, the 100kb bin over ERBB2 gained in 19.2%.

This is a frequency plot, not
[GISTIC](https://doi.org/10.1186/gb-2011-12-4-r41): there is no background
model, no significance test, and no peak calling, and amplitude enters only
through the gain/loss cutoff. It answers "in what fraction of the cohort", not
"more often than chance".

## Split the recurrence by clinical group

The recurrence track pools every tumor, so a peak is the cohort's average and
says nothing about which tumors make it up. `cnv_recurrence.py --groups` runs
the same tally once per value of a clinical column and writes each group its own
gain and loss column:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/cnv_recurrence.py
python3 cnv_recurrence.py tcga_brca_cnv.bed.gz by_subtype.bedGraph \
  --groups tcga_brca_clinical.tsv:subtype
```

That is the same
[clinical TSV](/docs/tutorials/tcga_cohort_mutations#what-the-two-files-hold)
the mutation cohort groups its matrix rows by, so a tumor falls in the same
group in both tracks.

`BedGraphTabixAdapter` reads every column past `end` as its own signal, so the
eight columns arrive as eight signals from one file, and a
[`MultiQuantitativeTrack`](/docs/config_guides/multiquantitative_track) draws
one row each. No subadapter list and no second file:

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

<Figure caption="Gain (red) and loss (blue) frequency per 100kb across the 22 autosomes and chrX, tallied separately for each receptor subtype and drawn one row per signal. 17q gain is confined to the HER2+ row, 5q loss and 10p gain to the triple-negative row, and 16q loss is the event the triple-negative row is missing; 1q and 8q gain are in every row. The bottom row of each block is the tumors whose receptor calls do not resolve a subtype." src="/img/tcga/cohort_cnv_recurrence_subtype.png" />

The rows can only be read against each other because
[`minScore`](/docs/config/multilinearwiggledisplay/#slot-minscore)/[`maxScore`](/docs/config/multilinearwiggledisplay/#slot-maxscore)
pin them to one axis. Left to autoscale, each row would fit its own maximum and
the four subtypes would look alike. The pin is tighter here than on the pooled
track above, at 70 rather than 100, because each row carries one signed
direction and so only ever fills the half of its axis on that side.

Gain and loss stay separate columns rather than collapsing to one signed value
per subtype. They are not redundant: at the edge of the 17q amplicon the HER2+
group is gained and lost at nearly the same rate, and a single net value would
draw that as roughly nothing right beside ERBB2.

Small groups are dropped, at `--min-group` tumors (20 by default), since a
percentage over a handful of tumors moves in visible steps and reads as signal.
The script names each group it skipped and how big it was.

Point `--groups` at any other column for a different split; `histology` and
`stage` come from harmonized GDC fields and so work for any TCGA project, while
`subtype` is breast specific.

## Read the same calls as a binned matrix

The stack asks tabix for every segment overlapping the view and rasterizes them
in the browser. At whole-genome zoom that is the entire file: 379,318 segments
for a picture a few hundred pixels tall. The same calls binned onto a fixed grid
answer that view out of one level of a resolution pyramid instead.

`tcga_brca_cnv.zarr` holds the 1104 tumors as a samples-by-bins matrix in a
[Zarr v3](https://zarr.dev/) store, one array per level from 10kb bins up to
3Mb. `MultiWiggleZarrAdapter` reads the coarsest level whose bins are still no
wider than a screen pixel, so a screenful costs a chunk or two at any zoom.
Bytes over the wire for three views, counted through each reader:

| View                  | BED + tabix | Zarr store | Zarr requests |
| --------------------- | ----------- | ---------- | ------------- |
| ERBB2, a 200kb window | 411 KB      | 14 KB      | 1             |
| chr17 end to end      | 411 KB      | 237 KB     | 12            |
| whole genome          | 5843 KB     | 1176 KB    | 4             |

The first row is the widest gap and most of it is not the binning. TCGA segments
average 2.6 Mb, so a query has to reach back to wherever an overlapping segment
started, and tabix reads the same 411 KB for a 200kb window as for the whole
chromosome — 1218 lines returned in the first case against 18,867 in the second.
Set against that, the store is 25 MB on disk to the BED's 5.9 MB. It earns its
place on the zoomed-out views and on cohorts larger than this one, not as a
replacement for the stack.

The plugin is in **beta** and not in the
[plugin store](/docs/user_guides/plugin_store) yet, but the built bundle is
hosted, so it loads from any config today (see
[configuring plugins](/docs/config_guides/plugins)):

```json
{
  "plugins": [
    {
      "name": "Zarr",
      "url": "https://jbrowse.org/demos/zarr/jbrowse-plugin-zarr.umd.production.min.js"
    }
  ],
  "tracks": [
    {
      "type": "MultiQuantitativeTrack",
      "trackId": "tcga_brca_cnv_zarr",
      "name": "TCGA-BRCA copy number, binned (1104 primary tumors)",
      "assemblyNames": ["hg38"],
      "category": ["TCGA"],
      "adapter": {
        "type": "MultiWiggleZarrAdapter",
        "uri": "https://jbrowse.org/demos/tcga/tcga_brca_cnv.zarr"
      },
      "displayDefaults": {
        "defaultRendering": "multirowdensity",
        "bicolorPivot": 0,
        "minScore": -2,
        "maxScore": 2,
        "posColor": "#b2182b",
        "negColor": "#2166ac"
      }
    }
  ]
}
```

<Figure caption="The same 1104 tumors over ERBB2 as the figure earlier on this page, clustered on this window, but read from the binned Zarr store instead of the segment BED. The amplified, gained, lost and balanced bands land in the same places because these are the same calls; the heatmap ramps continuously where the stack steps through five colors." src="/img/tcga/cohort_cnv_zarr_erbb2.png" />

The adapter config is the store's location and nothing else: the sample list,
the bin size and the resolution levels are attributes of the store. Each tumor's
receptor subtype rides along as its `group`, from the same clinical table the
recurrence split uses, so the clustering sidebar groups the rows the same way.

Color works differently here than on the stack. There is no jexl expression
binning `segmean` into five steps; a quantitative track ramps continuously
between `negColor` and `posColor` about `bicolorPivot`, which sits at 0 because
these are log2 ratios. `minScore` and `maxScore` clamp the ramp, one step
outside the stack's own ±1 amplification and deep-loss cutoffs. Pick round
numbers: the scale is `nice()`-rounded, so ±1.5 would quietly become the ±2 the
color bar draws anyway.

Clustering is scoped to the blocks in view either way, so the row order above is
this window's, not the cohort's genome-wide relatedness.

Binning is also the one thing this representation loses. A focal amplification
narrower than the base 10kb bin is averaged with its neighbours rather than
drawn at its own amplitude, where the stack keeps the caller's exact interval at
every zoom. For SNP 6.0 segments, whose mean length is 2.6 Mb, that costs
nothing; for exome or WGS callers emitting kilobase segments it would.

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

## Reproduce it end to end

One script builds both files for any project id, so nothing above depends on the
hosted copies:
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
# -> tcga_brca_cnv.bed.gz (+ .tbi), tcga_brca_cnv_recurrence.bedGraph.gz (+ .tbi),
#    tcga_brca_cnv_recurrence_by_subtype.bedGraph.gz (+ .tbi), tcga_brca_clinical.tsv
```

The full run is almost entirely downloading and produces 379,318 segments across
1104 tumors in 5.7 MB, plus 22,592 recurrence bins in 148 KB and 24,048 grouped
bins in 246 KB, both derived from that BED rather than re-downloaded. Swap in
any other project id (`TCGA-OV`, `TCGA-LUAD`, ...) for a different cohort, and
pass a third argument to group the recurrence by a different clinical column,
since `subtype` is breast specific.

Three of its steps decide whether the resulting track loads correctly. The first
is that it takes only open-access files: the GDC's **Masked Copy Number
Segment** files (Affymetrix SNP 6.0, already harmonized to GRCh38, germline CNV
probes removed) need no dbGaP application. The query also filters to
`Primary Tumor`, since TCGA banks a matched blood normal per case that would
double the row count and add no somatic signal.

The second is the reshape of `.seg` into BED. Two conversions matter, and
getting either wrong misplaces every feature: `.seg` names contigs bare (`1`),
so the script adds the `chr` prefix, and `.seg` starts are 1-based inclusive
against BED's 0-based half-open, so it subtracts 1. It also keeps one file per
barcode, since the replicate aliquots a few cases carry would otherwise land in
the same row and paint over each other (2 of 1106 files here, leaving 1104
tumors).

The third is that `Segment_Mean` is carried through unchanged. JBrowse plots
what the caller called; nothing here re-normalizes it.

The binned store is a separate script,
[`build_tcga_cohort_cnv_zarr.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_tcga_cohort_cnv_zarr.sh),
and not a step of the one above, because it needs none of what that one needed:
its inputs are the BED and the clinical table, so it runs against the hosted
copies in well under a minute rather than repeating the download. It needs
`node` 22 or newer and nothing else — no `npm install`, since the converter only
reaches for a BigWig reader on the path this does not take.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_tcga_cohort_cnv_zarr.sh
bash build_tcga_cohort_cnv_zarr.sh
# -> tcga_brca_cnv.zarr/ (29 MB, 1752 files)
```

It reads the cohort BED through
[`build_signal_zarr.ts`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_signal_zarr.ts)'s
`--bed` mode, naming the sample and value columns, and passes a `name<TAB>group`
table so each row carries its subtype. The levels are spaced about 3x apart
rather than 10x: the adapter takes the coarsest level no wider than a screen
pixel, so a 10x gap leaves a view that lands just under a level's bin size
reading up to 10x more bins than it can draw.

The recurrence step is separately runnable as
[`cnv_recurrence.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/cnv_recurrence.py),
if you have a cohort BED already and want only the frequency file. It skips bins
where fewer than half the cohort has any call, rather than drawing them as zero,
which here trims only the chromosome tips: SNP 6.0 segments span centromeres, so
the track has no interior gaps. That coverage mask is taken over the whole
cohort even when `--groups` is set, so the grouped file has the same gaps as the
pooled one and a group cannot lose a bin the cohort has calls for.

The clinical table comes from
[`tcga_clinical_tsv.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/tcga_clinical_tsv.py),
the same helper and the same arguments the
[mutation cohort](/docs/tutorials/tcga_cohort_mutations) uses, so one file
serves both tracks.

## Where to go next

The same one-row-per-sample pattern carries to other GDC open-access data:

- **Allele-specific copy number** (ASCAT, open access at the GDC) is the closest
  extension. It reports major and minor allele copy number separately, so it
  shows loss-of-heterozygosity, which the plain segment file above cannot: a
  copy-neutral LOH region looks balanced by total copy number but has lost a
  parental allele. Same `.seg` shape, same display, only the coloring expression
  changes.
- **Methylation** (Beta Value arrays, open access) is probe-level with genomic
  coordinates, and loads the same way with beta as the color field.

Splice junction quantification is not open access at the GDC, so a cohort
splicing view needs controlled-access RNA-seq and a dbGaP application. For open
splicing data, look outside TCGA (GTEx and recount3 publish junction summaries).

## See also

- [Multi-row feature tracks](/docs/user_guides/multirow_feature_track), the
  display's own menus and options
- [Quantitative tracks](/docs/user_guides/quantitative_track), for the
  recurrence track's scale and color controls
- [](/docs/tutorials/bxd_qtl), the same multi-row display for strain genotypes
- [](/docs/tutorials/chromhmm), the same display across cell types
- [](/docs/tutorials/population_cnv), the germline counterpart: one row per
  individual across a whole population, from per-sample bigWigs
- [Cancer SVs (C-GIAB)](/docs/tutorials/sv_visualization_cgiab), single-tumor
  structural and copy-number variation
- [jexl](/docs/config_guides/jexl)

## References

- [GDC Data Portal](https://portal.gdc.cancer.gov/)
- [GDC API documentation](https://docs.gdc.cancer.gov/API/Users_Guide/Getting_Started/)
- [TCGA publication guidelines](https://www.cancer.gov/ccg/research/genome-sequencing/tcga/using-tcga-data/citing)
