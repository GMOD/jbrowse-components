---
title: Multi-row feature track
description:
  Paint one labeled row per sample from a single interval file, with clustering
  and per-row coloring
guide_category: Track types
---

**TL;DR:** The multi-row feature display splits one interval file into a stack
of labeled rows, one per value of a column you nominate, and paints each feature
as a colored block. It is how a cohort of per-sample interval data (chromatin
states per cell type, copy number per tumor, ancestry per haplotype, genotype
per strain) becomes a single track with one config, one adapter, and one fetch,
rather than one track per sample.

Any BED, BigBed, GFF3, or GTF track can be switched to it from the track menu:
**Display types → Multi-row feature display (painting)**.

<Figure src="/img/chromhmm.png" caption="Roadmap Epigenomics 15-state ChromHMM across 127 epigenomes as one multi-row track, with NCBI RefSeq genes above. Each row is one epigenome and each block takes the state color the file already carries; the state key on the right is derived from the data." />

## Turning a feature track into rows

Picking it from **Display types** shows the rows right away.

<Figure src="/img/multirow/display_types_menu.png" caption="The track menu's Display types submenu on the UCSC RepeatMasker track, listing the multi-row display beside the default feature display. Any feature track can be switched over this way." />

By default it splits on the `name` column. To split on a column of your own, set
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

`partitionField` is the whole idea: it names the feature attribute whose value
assigns a feature to a row. Features sharing a value stack into the same row,
and the value becomes the row label.

Because this isn't the track's default display, it needs an explicit `displays`
entry rather than the `displayDefaults` shorthand (whose `color` would also
reach the default display).

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
  configuration at all.
- Otherwise each row is auto-assigned a distinct color from a categorical
  palette.

Binning a numeric column onto a diverging scale is the common jexl case, e.g.
segment mean copy number:

```json
{
  "type": "LinearMultiRowFeatureDisplay",
  "partitionField": "sample",
  "color": "jexl:get(feature,'segmean')<-1?'#2166ac':get(feature,'segmean')<-0.3?'#92c5de':get(feature,'segmean')<0.3?'#f7f7f7':get(feature,'segmean')<1?'#f4a582':'#b2182b'"
}
```

<Figure src="/img/tcga/cohort_cnv_genome.png" caption="TCGA-BRCA copy number across 1104 primary tumors, one row per tumor, colored by a jexl expression binning the caller's log2 ratio: blue loss, red gain. Recurrent events read as vertical stripes through the stack, under a wiggle track of the same cohort's gain/loss frequency." />

**Show... → Show legend** keys the colors actually present, and the
**Categories** submenu beside it hides individual categories, so you can drop
the states or classes you aren't reading and leave the rest painted. The submenu
counts what is hidden and offers **Show all categories** to put them back.

You can also recolor a single row by hand from **Edit colors/arrangement...**;
that overrides every source above for that row and applies at render time, with
no refetch.

## Row height

The track menu's **Row height** offers **Squeeze to fit view** (the default:
rows divide the track height, so adding samples shrinks the rows instead of
overflowing), **Normal**, and **Compact**. With fit, drag the track taller to
give a deep cohort more room per row.

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
  similar paintings sit together, and draws a dendrogram in the sidebar. Unlike
  the other clustering displays it runs without a dialog. See
  [Clustering rows](/docs/user_guides/clustering).

**Reset row order** appears in the track menu once any of the three has run, and
returns the rows to file order.

**Show... → Show sidebar with tree and labels** toggles the row labels and the
dendrogram. It sits with the other visibility toggles rather than in the
Clustering submenu, because the row labels are useful with no clustering run at
all.

<Figure src="/img/hprc2/local_ancestry_clustered.png" caption="64 HPRC haplotypes painted by local ancestry, rows clustered by similarity with the dendrogram beside them. Haplotypes sharing an ancestry profile group into blocks, so the colors sort into bands rather than the input file's order." />

## Worked examples

Each of these builds the input file and the track config end to end:

- [ChromHMM chromatin states](/docs/tutorials/chromhmm) - many cell types from
  one merged BED, colored by `itemRgb`
- [Cohort copy number (TCGA)](/docs/tutorials/tcga_cohort_cnv) - a thousand
  tumors, colored by a jexl expression over a numeric column
- [QTL visualization example](/docs/tutorials/bxd_qtl) - strain genotype
  painting beside a QTL Manhattan plot, sorted at the peak
- [Phased trio analysis](/docs/tutorials/analyze_trio) - IBD blocks and local
  ancestry per haplotype
- [Pangenome (HPRC)](/docs/tutorials/pangenome_hprc) - per-haplotype ancestry
  painting across a chromosome

## See also

- [Quantitative track](/docs/user_guides/quantitative_track)
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) - the
  same one-row-per-sample idea for signal rather than intervals
- [Multi-sample variant display](/docs/user_guides/multivariant_track)
- [LinearMultiRowFeatureDisplay config schema](/docs/config/linearmultirowfeaturedisplay)
- [Customizing feature colors](/docs/config_guides/customizing_feature_colors)
