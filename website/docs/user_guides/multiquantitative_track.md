---
title: Multi-quantitative track
description: Multiple signal tracks displayed together
guide_category: Track types
---

A multi-quantitative track combines several quantitative signals (typically
BigWig files) into one track with a shared Y axis. The track menu's
renderer-type submenu offers two families of rendering mode:

- Multi-row modes (`Multi-row XY plot`, `Multi-row density`, `Multi-row line`,
  `Multi-row scatter`) draw one plot per subtrack, stacked
- Overlapping modes (`Overlapping XY plot`, `Overlapping lines`,
  `Overlapping scatter`) draw all subtracks together

<Figure caption="The track menu lists the available renderer types." src="/img/multiwig/multi_renderer_types.png" />

In the multi-row modes the subtracks keep their configured colors. In the
overlapping modes the subtracks are auto-assigned colors from the palette. You
can edit colors and ordering from the track menu.

An outlier on one subtrack can blow out the shared Y axis. The "Local ± 3σ"
autoscale type clips to three standard deviations of the visible data, which
usually gives a more readable view. You can also pin the min and max from the
track menu.

## Adding a multi-quantitative track

Three ways to create one:

- The "Add a track" form lets you paste a list of BigWig URLs, or open multiple
  BigWig files from your machine
- The track selector lets you multi-select existing tracks and combine them into
  a multi-quantitative track
- Hand-edit the config, described in the
  [multi-quantitative track configuration](/docs/config_guides/multiquantitative_track/)
  guide

<Figure caption="The 'Add a track' form's workflow selector (red callout) lets you reach the multi-quantitative workflow, where you can paste a list of BigWig URLs or open multiple BigWig files from disk." src="/img/multiwig/addtrack.png" />
<Figure caption="In the track selector, the '...' menu adds individual tracks or whole categories to your selection. The cart icon in the 'Add a track' form then turns the selection into a multi-quantitative track." src="/img/multiwig/trackselector.png" />

## Loading bedMethyl as a multi-quantitative track

[modkit](https://github.com/nanoporetech/modkit) pileup produces a
[bedMethyl](https://www.encodeproject.org/data-standards/wgbs/) file, a
tab-separated BED format where each row reports the methylation fraction at a
single CpG position for one modification type (e.g. 5mC or 5hmC). It loads as
`BedTabixAdapter` and naturally maps to `MultiQuantitativeTrack`, with one
subtrack per modification type. For the per-read view of the same modified-base
calls, see
[Color by base modifications](/docs/user_guides/alignments_track#modifications-and-methylation)
on the alignments track.

### Generating the file

```bash
modkit pileup sample.bam output.bedmethyl --ref reference.fa --preset traditional
bgzip output.bedmethyl
tabix -p bed output.bedmethyl.gz
```

`--preset traditional` produces 5mC calls (5hmC is combined into the 5mC
fraction). Omit it for separate 5mC and 5hmC rows.

### Add-track UI

In the "Add a track" form, paste the URL to your `.bedmethyl.gz` file. JBrowse
detects the `.bedmethyl.gz` extension and selects `BedTabixAdapter` and
`MultiQuantitativeTrack` automatically.

### Config example

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "sample_modkit",
  "name": "CpG methylation (modkit)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": {
      "uri": "https://yourhost/sample_modkit.bedmethyl.gz"
    },
    "index": {
      "location": {
        "uri": "https://yourhost/sample_modkit.bedmethyl.gz.tbi"
      }
    }
  }
}
```

JBrowse reads the `score` column (column 11 in bedMethyl, the percent
methylation 0–100) and uses the `name` column (column 4, the modification code
such as `m` for 5mC or `h` for 5hmC) as the subtrack source label.

The COLO829 tumor modkit bedMethyl file is included in the
[demo config](https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json)
as the track **"COLO829_tumor.ht_modkit.bed (as MultiQuantitativeTrack)"** under
the Methylation category (assembly hg38, chr21).

## Clustering rows by score

Subtracks can be reordered by signal similarity using hierarchical clustering.
From the track menu, select **Cluster rows by score**. A dialog opens with two
modes:

- Auto mode runs hierarchical clustering (hclust via JavaScript) directly in the
  browser, sampling signal values at each pixel across the visible region.
- Manual mode downloads an R script that builds the score matrix and runs
  `hclust`. Run the script in R, then paste the resulting row ordering back into
  the dialog and click **Apply clustering**.

After clustering, the rows are reordered so that subtracks with similar signal
profiles sit together.

<Figure caption="Clustering a multi-quantitative track. Top: the 'Cluster by score' dialog with its auto/manual mode options. Bottom: after clustering, rows are reordered by signal similarity." src="/img/multiwig/cluster_dialog.png" />

The "Show tree" toggle in the track menu displays a dendrogram sidebar alongside
the reordered rows. With the tree shown, click any internal node to collapse the
view to that clade, and click it again to clear the subtree filter. Clustering
uses only the signal in the currently visible region, so navigate to a region of
interest before running it.

### Encoding a clustering result in a session URL

A clustering result can be embedded directly in a session snapshot, useful for
sharing a pre-computed clustering via URL. Set `layout`, `clusterTree`,
`treeAreaWidth`, and `subtreeFilter` in the display's `displaySnapshot` (see
[URL parameters → advanced track configuration](/docs/urlparams#advanced-track-configuration)).
The [MultiLinearWiggleDisplay config](/docs/config/multilinearwiggledisplay) has
the display's full config reference.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track) for single-signal
  BigWig/BedGraph display
- [Methylation tutorial](/docs/tutorials/methylation) for loading modkit
  bedMethyl as signal
- [Multi-quantitative track configuration](/docs/config_guides/multiquantitative_track)
  for config-file options
- [Gallery: coverage, copy number, and epigenomics](/gallery/#quantitative) for
  live CNV tumor/normal and clustered copy-number examples to open and explore
