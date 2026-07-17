---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `canvas`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts).

## Example usage

The data is a custom BED with a column naming each row (`partitionField`). Name
the columns with a `#`-prefixed header line so the adapter picks them up
(tab-separated, shown space-aligned):

```
#chrom  start    end      name  sample
chr1    0        2000000  seg1  HG00096
chr1    2000000  5500000  seg2  HG00096
chr1    0        3500000  seg3  HG00097
```

Paint one row per `sample`, coloring each row from `sampleColorMap`:

```js
{
  type: 'FeatureTrack',
  trackId: 'ancestry_painting',
  name: 'Ancestry painting',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://example.com/painting.bed.gz',
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      displayId: 'ancestry_painting-LinearMultiRowFeatureDisplay',
      partitionField: 'sample',
      sampleColorMap: { HG00096: '#4e79a7', HG00097: '#f28e2b' },
    },
  ],
}
```

Omit `sampleColorMap` entirely and each row is auto-assigned a distinct palette
color — unless the features carry an `itemRgb`, which is honored as the
per-feature color with no configuration at all. To color per feature off some
other attribute, set the `color` slot to a `jexl:` expression reading it.

_See the **Config slots** section below for all available configuration fields._

Paints interval features as colored blocks on stacked rows ("chromosome /
ancestry painting"). Rows are partitioned by a feature attribute
(`partitionField`). Block color comes from `sampleColorMap` (keyed by the
partition value) when set, else a customized per-feature `color` slot, else an
automatically-assigned per-row color from a categorical palette. A row color
picked interactively in the "Edit colors/arrangement..." track-menu dialog
overrides all of these for that row (applied at render time, no refetch).

These are display-level slots. This is not a `FeatureTrack`'s default display,
so configure it with an explicit `displays` entry (rather than the
`displayDefaults` shorthand, whose `color` would also reach the default
`LinearBasicDisplay`).

## Related links

- **Adapter:** [BedAdapter](../bedadapter)
- **Adapter:** [BedTabixAdapter](../bedtabixadapter)
- **Adapter:** [BigBedAdapter](../bigbedadapter)
- **Adapter:** [Gff3Adapter](../gff3adapter)
- **Adapter:** [Gff3TabixAdapter](../gff3tabixadapter)
- **Adapter:** [GtfAdapter](../gtfadapter)
- **Adapter:** [GtfTabixAdapter](../gtftabixadapter)
- **State model:** [runtime API](../../models/linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type          | Description                                                                                                                          |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [partitionField](#slot-partitionfield)     | `string`      | Feature attribute whose value assigns each feature to a row (e.g. a BED column name).                                                |
| [color](#slot-color)                       | `maybeColor`  | Per-block fill: a CSS color, or a `jexl:` expression for per-feature coloring (e.g. ``jexl:`rgb(${get(feature,'ancestryRgb')})` ``). |
| [sampleColorMap](#slot-samplecolormap)     | `frozen`      | Optional map of `partitionField` value to color, e.g. `{ HG00096: '#4e79a7' }`.                                                      |
| [rowOrder](#slot-roworder)                 | `stringArray` | Optional explicit row order.                                                                                                         |
| [rowHeight](#slot-rowheight)               | `number`      | Fixed height in pixels of each row.                                                                                                  |
| [showLegend](#slot-showlegend)             | `boolean`     | Show the categorical color key (swatch + label per distinct per-feature color).                                                      |
| [legend](#slot-legend)                     | `frozen`      | Explicit color key: an array of `{ label, color }`.                                                                                  |
| [showTree](#slot-showtree)                 | `boolean`     | show the cluster tree sidebar                                                                                                        |
| [showBranchLength](#slot-showbranchlength) | `boolean`     | Position tree nodes by cluster merge height (dendrogram) vs.                                                                         |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                 | Type     | Description                                                                          |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| [rowProportion](#slot-rowproportion) | `number` | Fraction of the row height each block fills (1 = full, leaving no gap between rows). |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Slots</summary>

#### slot: partitionField

Feature attribute whose value assigns each feature to a row (e.g. a BED column
name). Features sharing a value stack into the same row.

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'name'`

#### slot: color

Per-block fill: a CSS color, or a `jexl:` expression for per-feature coloring
(e.g. ``jexl:`rgb(${get(feature,'ancestryRgb')})` ``). Unset, a feature's own
`itemRgb` is used if it has one, and otherwise each row gets a distinct color
from a categorical palette.

**Type:** `maybeColor` · **Default:** `undefined`

```js
{
  type: 'maybeColor',
  defaultValue: undefined,
  description:
    "fill color of each block (CSS color or jexl expression for per-feature coloring). Unset, a feature's own itemRgb paints it if it has one, else each row gets a distinct color from a categorical palette",
  contextVariable: ['feature'],
}
```

#### slot: sampleColorMap

Optional map of `partitionField` value to color, e.g. `{ HG00096: '#4e79a7' }`.
When a feature's partition value has an entry here it overrides the `color`
slot, so whole rows can be colored without a per-feature color column.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: rowOrder

Optional explicit row order. Rows listed here come first in this order; any
remaining partition values are appended in sorted order. Empty = fully auto
(sorted).

**Type:** `stringArray` · **Default:** `[]`

#### slot: rowHeight

Fixed height in pixels of each row. `0` (the default) auto-fits: all rows
stretch to fill the display height, so adding rows shrinks them instead of
growing the track — a dense, fully-visible painting.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0`

#### slot: rowProportion

Fraction of the row height each block fills (1 = full, leaving no gap between
rows).

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: showLegend

Show the categorical color key (swatch + label per distinct per-feature color).
Only appears in per-feature color mode; in per-row palette / sampleColorMap mode
the sidebar labels are already the key, so nothing shows regardless. The entries
come from `legend` when set, else are auto-derived from named, categorical
features (e.g. chromHMM states).

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: legend

Explicit color key: an array of `{ label, color }`. Use this when the category
is encoded only in the block color (e.g. an `itemRgb` ancestry painting) so
there's no feature attribute to auto-derive a legend from — the mapping is a
semantic the data doesn't carry, so the config declares it. `color` is any CSS
color and should match what `color` paints. Overrides the auto-derived legend
when non-empty.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `[]`

**Example:**

```js
legend: [
  { label: 'Maternal', color: 'rgb(227,26,28)' },
  { label: 'Paternal', color: 'rgb(31,120,180)' },
  { label: 'Unknown', color: 'rgb(170,170,170)' },
]
```

#### slot: showTree

show the cluster tree sidebar

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showBranchLength

Position tree nodes by cluster merge height (dendrogram) vs. evenly by topology
(cladogram).

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>
