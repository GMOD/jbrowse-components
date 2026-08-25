---
title: Multi-row feature track
description:
  Paint one labeled row per sample from a single interval file, with clustering
  and per-row coloring
guide_category: Track types
---

**TL;DR:** The multi-row feature display splits one interval file into a stack
of labeled rows, one per value of a column you nominate, and paints each feature
as a colored block. A cohort of per-sample interval data (chromatin states per
cell type, copy number per tumor, ancestry per haplotype, genotype per strain)
becomes a single track with one config, one adapter, and one fetch.

Any BED, BigBed, GFF3, or GTF track can be switched to it from the track menu:
**Display types → Multi-row feature display (painting)**.

<Figure src="/img/chromhmm.png" caption="Roadmap Epigenomics 15-state ChromHMM across 127 epigenomes as one multi-row track, with NCBI RefSeq genes above. Each row is one epigenome taking the state color the file carries, and the stripe on the left is its Roadmap tissue group. Boxed: the two halves of the HOXA cluster, where one block of rows opens the cluster and the rest hold it repressed." />

## Turning a feature track into rows

Picking it from **Display types** shows the rows right away, split on whichever
column the file turns out to carry: a RepeatMasker table opens as ~20 rows of
`repClass`, and anything else falls back to the `name` column. Which column
assigns a feature to a row is then **Partition by…** in the same track menu,
which lists the attribute names the loaded features carry — so RepeatMasker also
offers `repFamily` and `name` beside the class it started on. Repartitioning
discards a saved row order, a clustering run and any hidden categories, since
all three name rows that the new partition does not have.

<Figure src="/img/multirow/display_types_menu.png" caption="Turning the UCSC RepeatMasker track into rows: the track menu's Display types submenu (top), and the same window partitioned by repeat class (bottom). Any feature track can be switched over this way." />

To fix the column in config rather than picking it per session, set
[`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
in the track config:

```json
{
  "type": "FeatureTrack",
  "trackId": "chromhmm",
  "name": "ChromHMM states",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://example.com/chromhmm.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "chromhmm-LinearMultiRowFeatureDisplay",
      "partitionField": "cellType"
    }
  ]
}
```

`partitionField` names the feature attribute whose value assigns a feature to a
row. Features sharing a value stack into the same row, and the value becomes the
row label.

The rows are discovered from the values the loaded region holds, so a file that
gains a sample or a category needs no config change, and a region missing one
has no row for it.

### Partitioning with a jexl expression {#when-the-category-is-not-a-column}

A file can carry the category without carrying a column for it, in which case
`partitionField` takes a [jexl](/docs/config_guides/jexl) expression instead of
an attribute name. UCSC's `bigRmskBed` is the common case: the repeat class is a
suffix on the name (`L1HS#LINE/L1`), so an attribute lookup splits on the full
repeat name, which is thousands of rows rather than twenty.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "genark_rmsk",
  "name": "RepeatMasker by class",
  "assemblyNames": ["GCF_019238085.1"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/019/238/085/GCF_019238085.1/bbi/GCF_019238085.1_USGS_WTPT01.rmsk.bb"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "genark_rmsk-LinearMultiRowFeatureDisplay",
      "partitionField": "jexl:split(split(feature.name,'#')[1],'/')[0]"
    }
  ]
}
```

Swapping the final `[0]` for `[1]` splits by family instead of class.

This isn't the track's default display, so it needs an explicit `displays` entry
rather than the `displayDefaults` shorthand (whose `color` would also reach the
default display).

## Preparing the file

The input is one file holding every sample's intervals, with a column naming the
sample. For BED, name the columns with a `#`-prefixed header line so the adapter
picks them up, then bgzip and tabix as usual:

```
#chrom  chromStart  chromEnd  name               score  strand  thickStart  thickEnd  itemRgb      cellType
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  GM12878
chr1    10000       10600     15_Repetitive/CNV  0      .       10000       10600     245,245,245  K562
```

Any extra column works the same way, so `partitionField` can be `sample`,
`cellType`, `strain`, `haplotype`, or whatever you called it. GFF3/GTF
attributes and BigBed extra fields are addressed by name identically.

## Coloring the blocks

Four sources of color, in precedence order:

- [`sampleColorMap`](/docs/config/linearmultirowfeaturedisplay/#slot-samplecolormap)
  gives a color per row, keyed by the `partitionField` value. Use it when the
  row identity is the signal (one color per population, per treatment arm).
- [`color`](/docs/config/linearmultirowfeaturedisplay/#slot-color) is a per-
  feature fill: a CSS color, or a [jexl](/docs/config_guides/jexl) expression
  reading any attribute. This is how a continuous value becomes a color scale,
  by binning it in the expression.
- `itemRgb` is honored automatically. A BED9 that already carries per-feature
  colors (ChromHMM state colors, for one) paints correctly with no color
  configuration.
- Otherwise each row is auto-assigned a distinct color from a categorical
  palette.

Binning a numeric column onto a diverging scale is the common jexl case, e.g.
segment mean copy number:

```json
{
  "type": "FeatureTrack",
  "trackId": "tcga_brca_cnv",
  "name": "TCGA-BRCA copy number",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "tcga_brca_cnv-LinearMultiRowFeatureDisplay",
      "partitionField": "sample",
      "color": "jexl:feature.segmean<-1?'#2166ac':feature.segmean<-0.3?'#92c5de':feature.segmean<0.3?'#f7f7f7':feature.segmean<1?'#f4a582':'#b2182b'"
    }
  ]
}
```

<Figure src="/img/tcga/cohort_cnv_genome.png" caption="TCGA-BRCA copy number across 1104 primary tumors, one row per tumor, colored by a jexl expression binning the caller's log2 ratio. Recurrent events read as vertical stripes through the stack, under the same cohort's gain/loss frequency." />

**Show... → Show legend** keys the colors actually present, and the
**Categories** submenu beside it hides individual categories, so you can drop
the states or classes you aren't reading and leave the rest painted. The submenu
counts what is hidden and offers **Show all categories** to put them back.

You can also recolor a single row by hand from **Edit colors/arrangement...**;
that overrides every source above for that row and applies at render time, with
no refetch.

## Row height

The track menu's **Row height** offers **Squeeze to fit view** (the default:
rows divide the track height, so adding samples shrinks the rows), **Normal**,
and **Compact**. With fit, drag the track taller to give a deep cohort more room
per row.

## Ordering and clustering rows

Rows start in file order. Three ways to change that:

- **Edit colors/arrangement...** reorders or hand-picks rows in a dialog, and
  [`rowOrder`](/docs/config/linearmultirowfeaturedisplay/#slot-roworder) pins an
  explicit order in config.
- Right-click a position and choose **Sort rows by color here** to order rows by
  the value each carries at that exact base, the analogue of an alignments
  track's sort-by-base. Rows sharing a value become contiguous blocks, which is
  what turns a QTL painting at its peak into a clean split by allele. **Clear
  row sort** restores the previous order.
- **Clustering → Cluster rows by similarity** reorders rows so that samples with
  similar paintings sit together, and draws a dendrogram in the sidebar. It runs
  without a dialog. See [](/docs/user_guides/clustering).

**Reset row order** appears in the track menu once any of the three has run, and
returns the rows to file order.

**Show... → Show tree** toggles the dendrogram once one has been computed, and
**Show... → Show row labels** the labels beside it, which are useful with no
clustering run.

**Show... → Color row labels by row color** tints each label with the color that
row's blocks are painted in, so a row can be found by color rather than by
reading down a column of similar names. It is off by default: the label box is
also what `rowGroups` and a color set in **Edit colors/arrangement…** use, and
both of those win over it. It does nothing on a track colored per feature (an
`itemRgb` painting, a jexl `color` slot), where no single color is the row's.

<Figure src="/img/tcga/cohort_cnv_erbb2.png" caption="chr17:39.0-40.5Mb, 1104 TCGA-BRCA tumors clustered by copy-number profile with the dendrogram and row labels beside them. Rows sort into amplified, gained, lost, and balanced bands instead of the input file's order." />

## Worked examples

Each of these builds the input file and the track config end to end:

- [](/docs/tutorials/chromhmm) - many cell types from one merged BED, colored by
  `itemRgb`
- [](/docs/tutorials/tcga_cohort_cnv) - a thousand tumors, colored by a jexl
  expression over a numeric column
- [](/docs/tutorials/bxd_qtl) - strain genotype painting beside a QTL Manhattan
  plot, sorted at the peak
- [](/docs/tutorials/analyze_trio) - IBD blocks and local ancestry per haplotype

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multiquantitative_track) - the same one-row-per-sample
  idea for signal rather than intervals
- [](/docs/user_guides/multivariant_track)
- [LinearMultiRowFeatureDisplay config schema](/docs/config/linearmultirowfeaturedisplay)
- [](/docs/config_guides/customizing_feature_colors)
- [ROW_HEIGHT_AND_FIT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ROW_HEIGHT_AND_FIT.md)
  — the same Row height menu across every multi-row display: the slot whose `0`
  means fit, and the resolved getter beside it that other plugins read
