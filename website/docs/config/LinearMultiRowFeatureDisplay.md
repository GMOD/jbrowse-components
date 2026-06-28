---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearMultiRowFeatureDisplay.md)

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
color. For per-feature (not per-row) colors, set the `color` slot instead:
`color: "jexl:get(feature,'itemRgb')"` for a standard BED12, or read a custom
color column.

_See the **Slots** section below for all available configuration fields._

## Overview

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

### LinearMultiRowFeatureDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearmultirowfeaturedisplay).

<details open>
<summary>LinearMultiRowFeatureDisplay - Slots</summary>

#### slot: partitionField

Feature attribute whose value assigns each feature to a row (e.g. a BED column
name). Features sharing a value stack into the same row.

**Type:** `string` · **Default:** `'name'`

```js
{
  type: 'string',
  defaultValue: 'name',
  description: 'feature attribute that assigns each feature to a row',
}
```

#### slot: color

Per-block fill (a CSS color, or a `jexl:` expression for per-feature coloring,
e.g. `jexl:get(feature,'itemRgb')`). Left at its default, each row instead gets
a distinct color from a categorical palette.

**Type:** `color`

```js
{
  type: 'color',
  defaultValue: MULTIROW_DEFAULT_COLOR,
  description:
    'fill color of each block (CSS color or jexl expression for per-feature coloring); the default auto-assigns a per-row palette color',
  contextVariable: ['feature'],
}
```

#### slot: sampleColorMap

Optional map of `partitionField` value to color, e.g. `{ HG00096: '#4e79a7' }`.
When a feature's partition value has an entry here it overrides the `color`
slot, so whole rows can be colored without a per-feature color column.

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: {},
  description:
    'map of partition value to color; overrides the color slot for matching features',
}
```

#### slot: rowOrder

Optional explicit row order. Rows listed here come first in this order; any
remaining partition values are appended in sorted order. Empty = fully auto
(sorted).

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'optional explicit row order (by partition value)',
}
```

#### slot: rowHeight

Fixed height in pixels of each row. `0` (the default) auto-fits: all rows
stretch to fill the display height, so adding rows shrinks them instead of
growing the track — a dense, fully-visible painting.

**Type:** `number` · **Default:** `0`

```js
{
  type: 'number',
  defaultValue: 0,
  description:
    'fixed row height in px; 0 (default) auto-fits all rows to the display height',
}
```

#### slot: rowProportion

Fraction of the row height each block fills (1 = full, leaving no gap between
rows).

**Type:** `number` · **Default:** `0.9`

```js
{
  type: 'number',
  defaultValue: 0.9,
  description: 'fraction of the row height each block fills',
  advanced: true,
}
```

</details>
