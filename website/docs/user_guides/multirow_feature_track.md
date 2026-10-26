---
title: Multi-row feature track
description:
  Paint one labeled row per sample from a single interval file, with clustering
  and per-row coloring
guide_category: Track types
---

The multi-row feature display splits one interval file into a stack of labeled
rows, one per value of a column you nominate, and paints each feature as a
colored block. A cohort of per-sample interval data (chromatin states per cell
type, copy number per tumor, ancestry per haplotype, genotype per strain)
becomes a single track with one config, one adapter, and one fetch.

Any BED, BigBed, GFF3, or GTF track can be switched to it from the track menu:
**Display types → Multi-row feature display (painting)**. It draws the features
as a plot of marks, a `rect` per feature, so
[**Advanced → Edit plot...**](/docs/user_guides/edit_plot) and **Edit marks...**
reach every mark, scale, filter and facet setting.

<Figure src="/img/chromhmm.png" caption="Roadmap 15-state ChromHMM as a multi-row track, 127 epigenomes in tissue order, each row tinted by its tissue group." />

## Turning a feature track into rows

Picking it from **Display types** reads a sample of the features once and splits
them on whichever column the file turns out to have: a RepeatMasker table opens
as ~20 rows of `repClass`, and anything else falls back to the `name` column.
Which column assigns a feature to a row is then **One row per...** in the same
track menu, which lists the attributes the sampled features carry, so
RepeatMasker also offers `repFamily` and `name` beside the class it started on.
A saved row order, its labels and colors, and a clustering run survive a
repartition. They name rows by value, so they match no row under the new
partition and apply again when the field comes back.

<Figure src="/img/multirow/display_types_menu.png" caption="The RepeatMasker track's Display types submenu (top), and the same window partitioned by repeat class (bottom)." />

To fix the column in config, set
[`rows`](/docs/config/linearmultirowfeaturedisplay/#slot-rows) in the track
config:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "chromhmm",
  "name": "ChromHMM states",
  "uri": "https://example.com/chromhmm.bed.gz",
  "assemblyNames": ["hg19"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "chromhmm-LinearMultiRowFeatureDisplay",
      "rows": "cellType"
    }
  ]
}
```

`rows` names the feature attribute whose value assigns a feature to a row.
Features sharing a value stack into the same row, and the value becomes the row
label.

A feature whose children have none of their own, such as a BED12 row or a GFF
transcript at the top of its file, draws them as blocks joined by a line, as a
gene track draws exons. The plot is then two marks, a line over each feature and
a `rect` over its blocks, and a hover or a click on any block answers for the
whole feature.

The rows are discovered from the values of the features in the window, so a file
that gains a sample or a category needs no config change, and a window missing
one has no row for it. The rows follow the window as it pans.

### Partitioning with a jexl expression {#when-the-category-is-not-a-column}

A file can have the category without a column for it, in which case `rows` takes
a [jexl](/docs/config_guides/jexl) expression instead of an attribute name.
UCSC's `bigRmskBed` is the common case: the repeat class is a suffix on the name
(`L1HS#LINE/L1`), so an attribute lookup splits on the full repeat name, which
is thousands of rows rather than twenty.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genark_rmsk",
  "name": "RepeatMasker by class",
  "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/019/238/085/GCF_019238085.1/bbi/GCF_019238085.1_USGS_WTPT01.rmsk.bb",
  "assemblyNames": ["GCF_019238085.1"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "genark_rmsk-LinearMultiRowFeatureDisplay",
      "rows": "jexl:split(split(feature.name,'#')[1],'/')[0]"
    }
  ]
}
```

The final `[0]` selects class; swap it for `[1]` to split by family.

The multi-row display isn't the track's default, so it needs an explicit
`displays` entry rather than the `displayDefaults` shorthand (whose
`encoding.color` would also reach the default display).

## Preparing the file

The input is one file holding every sample's intervals, with a column naming the
sample. For BED, name the columns with a `#`-prefixed header line so the adapter
picks them up, then bgzip and tabix as usual:

```text
#chrom  chromStart  chromEnd  name               score  strand  thickStart  thickEnd  itemRgb      cellType
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  GM12878
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  K562
```

Any extra column works the same way, so `rows` can be `sample`, `cellType`,
`strain`, `haplotype`, or whatever you called it. A GFF3/GTF attribute or BigBed
extra field works by name.

## Coloring the blocks

The blocks take the first of these that names a color:

- [`encoding.color`](/docs/config/markdisplayencoding/#slot-color), a
  per-feature fill: a CSS color as its `value`, or a field whose values each
  take a color through a scale (a color per value, a color per interval between
  cut points, or a gradient) with a key naming them. **Color by** writes it.
- A feature's own color. A BED9 whose features state an `itemRgb` (ChromHMM
  state colors, for one) opens painted with them, as
  `encoding.color.scale.type: "identity"`; `scale.domain` and `scale.names` name
  those colors in the key, and a `field` reads the colors a column holds.
- [`rowColor`](/docs/config/linearmultirowfeaturedisplay/#slot-rowcolor), a
  color per row as pairs, the row values in `scale.domain` and their colors in
  `scale.range`, or with a `field` a color per value of a row attribute such as
  its `rowGroups` group. Use it when the row identity is the signal (one color
  per population, per treatment arm).
- Otherwise the default feature color.

Binning a numeric column onto a diverging scale is the common case, e.g. segment
mean copy number, with `scale.names` naming each interval in the key:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "tcga_brca_cnv",
  "name": "TCGA-BRCA copy number",
  "uri": "https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz",
  "assemblyNames": ["hg38"],
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "tcga_brca_cnv-LinearMultiRowFeatureDisplay",
      "rows": "sample",
      "encoding": {
        "color": {
          "field": "segmean",
          "scale": {
            "type": "threshold",
            "domain": [-1, -0.3, 0.3, 1],
            "range": ["#2166ac", "#92c5de", "#f7f7f7", "#f4a582", "#b2182b"],
            "names": [
              "Deep loss (log2 < -1)",
              "Loss",
              "Balanced",
              "Gain",
              "Amplification (log2 > 1)"
            ]
          },
          "legend": { "title": "Copy number (log2)" }
        }
      }
    }
  ]
}
```

<Figure src="/img/tcga/cohort_cnv_genome.png" caption="TCGA-BRCA copy number, one row per tumor, colored by the interval its log2 ratio falls in." />

**Show → Legend** keys the colors actually present, and the **Categories**
submenu beside it hides individual categories, so you can drop the states or
classes you aren't reading and leave the rest painted. The submenu counts what
is hidden and offers **Show all categories** to put them back.
`encoding.color.scale.domain` sets the order those rows read in — the values it
lists first, the rest sorted — the same rule `rows.sort` orders the track's rows
by.

You can also pick a color for single rows under **Color rows by → Each row** in
**Edit colors/arrangement...**, which writes each as a `rowColor` entry and
applies at render time, with no refetch.

## Row height

The rows divide the track height between them, as a multi-row wiggle's do, so
more samples shrink the rows and the track keeps its height. Drag the track
taller to give a deep cohort more room per row, or pick **Row height** to give
each row a fixed height and scroll the rest. **Show → Row separators** draws a
line between rows once they are tall enough to hold one.

## Ordering and clustering rows

Rows start sorted by value, digits by magnitude, with the row of features with
no value last. Three ways to change that:

- **Edit colors/arrangement...** reorders, relabels or hand-picks rows in a
  dialog, and `rows.sort` pins an explicit order in config: the values it lists
  lead, and the rest sort.
- Right-click a feature and choose **Sort rows by _field_ here** to order rows
  by the value each has at that exact base, the analogue of an alignments
  track's sort-by-base. Rows compare on what colors the blocks, the same as
  clustering: the color's field, a feature's own color, or with one color for
  everything whether a row has a feature there. Numbers sort highest first;
  other values form contiguous blocks, the largest first, turning a QTL painting
  at its peak into a clean split by allele.
- **Clustering → Cluster rows by similarity...** reorders rows so that samples
  with similar paintings sit together, and draws a dendrogram in the sidebar.
  See [](/docs/user_guides/clustering).

Each of the three ways of reordering writes the track's
[`rows`](/docs/config/linearmultirowfeaturedisplay/#slot-rows) setting, so undo
reaches an arrangement, a shared session contains it, and it survives turning
the track off and on. **Reset row order** appears in the track menu once any of
the three has run, and returns the rows, their labels and their colors to what
the config declares.

[`rowGroups`](/docs/config/linearmultirowfeaturedisplay/#slot-rowgroups) tags
each row with a `group`, the first `{ match, group }` entry whose regex its name
matches, and
[`facet: "group"`](/docs/config/linearmultirowfeaturedisplay/#slot-facet) stacks
the rows in bands by it, each band named in a strip beside the dendrogram and
keeping its rows in their arranged order; clustering then runs within each band.
A group takes its color from `rowColor`:

```json
{
  "rowGroups": [
    { "match": "^CLUP", "group": "Wolf" },
    { "match": "^CLAT", "group": "Coyote" }
  ],
  "facet": "group",
  "rowColor": {
    "field": "group",
    "scale": {
      "domain": ["Wolf", "Coyote"],
      "range": ["rgb(27,120,55)", "rgb(224,130,20)"]
    }
  }
}
```

A band marks a group by position, which stays readable over many groups where
colors alone are hard to tell apart, so facet a long list of groups and use the
colors as a second cue.

**Show → Tree** toggles the dendrogram once one has been computed, and **Show →
Row labels** the labels beside it, which are useful with no clustering run.

A row that
[`rowColor`](/docs/config/linearmultirowfeaturedisplay/#slot-rowcolor) colors by
its name or by an attribute such as its group draws a bar of that color at the
left of its label, so a row can be found by color. A row with no value of that
attribute, such as one no `rowGroups` entry matches, takes no color unless
`scale.domain` pairs `""` with one. On a track colored per feature (an `itemRgb`
painting, a jexl `encoding.color`) the bar is the only place a row's color
shows.

<Figure src="/img/tcga/cohort_cnv_erbb2.png" caption="1104 tumors clustered by copy-number profile around ERBB2, with the dendrogram beside them." />

## Worked examples

Each of these builds the input file and the track config end to end:

- [](/docs/tutorials/chromhmm) - many cell types from one merged BED, colored by
  `itemRgb`
- [](/docs/tutorials/tcga_cohort_cnv) - a thousand tumors, colored by the
  interval a numeric column falls in
- [](/docs/tutorials/bxd_qtl) - strain genotype painting beside a QTL Manhattan
  plot, sorted at the peak
- [](/docs/tutorials/analyze_trio) - IBD blocks and local ancestry per haplotype

## See also

- [](/docs/user_guides/quantitative_track) - the same one-row-per-sample idea
  for signal data
- [](/docs/user_guides/multivariant_track)
- [LinearMultiRowFeatureDisplay config schema](/docs/config/linearmultirowfeaturedisplay)
- [](/docs/config_guides/customizing_feature_colors)
- [ROW_HEIGHT_AND_FIT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ROW_HEIGHT_AND_FIT.md)
  — how each multi-row display fits its rows, and the resolved row height other
  plugins read
