---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts).

## Example usage

Minimal `MultiQuantitativeTrack` config. See the
[multi-quantitative track guide](/docs/config_guides/multiquantitative_track)
for all adapter and display options:

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'coverage_by_sample',
  name: 'Coverage by sample',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
}
```

Taller track overlaying two samples in one shared plot (`multixyplot`) instead
of the default stacked-per-subtrack layout:

```js
{
  type: 'MultiQuantitativeTrack',
  trackId: 'coverage_by_sample',
  name: 'Coverage by sample',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    bigWigs: [
      'https://example.com/sample1.bw',
      'https://example.com/sample2.bw',
    ],
  },
  displayDefaults: { height: 300, defaultRendering: 'multixyplot' },
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the multi-wiggle display, which draws several quantitative
subtracks (e.g. BigWig files) on a shared Y axis

These are display-level slots: set them inside a track's `displays` to change
its defaults (setting them at the track top level has no effect). The object
shorthand `displayDefaults: { key: value }` is equivalent to the full
`displays: [{ type: 'MultiLinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

Per-subtrack metadata (a `name`, `color`, and `group` for each subtrack) is
preloaded on the _adapter_, not here — use `MultiWiggleAdapter`'s `subadapters`
slot, where `group` drives the sidebar clustering tree and `color` sets each
subtrack's line/fill.

## Related links

- **Adapter:** [MultiWiggleAdapter](../multiwiggleadapter)
- **State model:** [runtime API](../../models/multilinearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                         | Type                                                                                                                                                 | Description                                                                                                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [height](#slot-height)                       | `number`                                                                                                                                             | Default height of the track                                                                                                                                                                                              |
| [summaryScoreMode](#slot-summaryscoremode)   | `stringEnum` (max, min, avg, whiskers)                                                                                                               | choose whether to use max/min/average or whiskers which combines all three into the same rendering                                                                                                                       |
| [defaultRendering](#slot-defaultrendering)   | `stringEnum` (multirowxy, multirowdensity, multirowline, multirowlinecenter, multirowscatter, multixyplot, multiline, multilinecenter, multiscatter) | Default rendering type.                                                                                                                                                                                                  |
| [showTree](#slot-showtree)                   | `boolean`                                                                                                                                            | Show the subtrack clustering tree in the sidebar                                                                                                                                                                         |
| [showBranchLength](#slot-showbranchlength)   | `boolean`                                                                                                                                            | Draw the clustering tree with branch lengths                                                                                                                                                                             |
| [showRowSeparators](#slot-showrowseparators) | `boolean`                                                                                                                                            | Draw separator lines between subtrack rows                                                                                                                                                                               |
| [showLegend](#slot-showlegend)               | `boolean`                                                                                                                                            | Draw the source color key in overlay mode                                                                                                                                                                                |
| [posColor](#slot-poscolor)                   | `color`                                                                                                                                              | Fill color for positive scores, used when useBicolor is true (the default)                                                                                                                                               |
| [negColor](#slot-negcolor)                   | `color`                                                                                                                                              | Fill color for negative scores, used when useBicolor is true (the default)                                                                                                                                               |
| [scaleType](#slot-scaletype)                 | `stringEnum` (linear, log)                                                                                                                           | Scale type (linear or log)                                                                                                                                                                                               |
| [autoscale](#slot-autoscale)                 | `stringEnum` (local, localsd, localpercentile)                                                                                                       | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) |

<details>
<summary>Advanced slots (8)</summary>

| Slot                                       | Type          | Description                                                                                                              |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [minimalTicks](#slot-minimalticks)         | `boolean`     | Draw only the min/max Y-axis ticks                                                                                       |
| [bicolorPivot](#slot-bicolorpivot)         | `number`      | Pivot value for bicolor mode                                                                                             |
| [minScore](#slot-minscore)                 | `number`      | Fixed minimum score bound.                                                                                               |
| [maxScore](#slot-maxscore)                 | `number`      | Fixed maximum score bound.                                                                                               |
| [numStdDev](#slot-numstddev)               | `number`      | Number of standard deviations to use for the localsd autoscale type                                                      |
| [numQuantile](#slot-numquantile)           | `number`      | Percentile used to clip outliers for the localpercentile autoscale type (e.g. 0.99 clips the outermost 1% of each sign). |
| [scatterPointSize](#slot-scatterpointsize) | `maybeNumber` | Point height in px for scatterplot ("scatter"/"multiscatter") rendering.                                                 |
| [lineWidth](#slot-linewidth)               | `maybeNumber` | Line thickness in px for line ("line"/"multiline") rendering.                                                            |

</details>

<details>
<summary>MultiLinearWiggleDisplay - Slots</summary>

#### slot: height

Default height of the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `200`

#### slot: summaryScoreMode

choose whether to use max/min/average or whiskers which combines all three into
the same rendering

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`max`, `min`, `avg`, `whiskers`) · **Default:** `'avg'`

#### slot: defaultRendering

Default rendering type. Multi-row modes (`multirowxy`, `multirowdensity`,
`multirowline`, `multirowscatter`) draw one stacked plot per subtrack;
overlapping modes (`multixyplot`, `multiline`, `multiscatter`) draw all
subtracks together in one shared plot.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`multirowxy`, `multirowdensity`, `multirowline`, `multirowlinecenter`,
`multirowscatter`, `multixyplot`, `multiline`, `multilinecenter`,
`multiscatter`) · **Default:** `'multirowxy'`

**Example:**

```json
{
  "type": "MultiLinearWiggleDisplay",
  "defaultRendering": "multixyplot"
}
```

#### slot: minimalTicks

Draw only the min/max Y-axis ticks

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: showTree

Show the subtrack clustering tree in the sidebar

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showBranchLength

Draw the clustering tree with branch lengths

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showRowSeparators

Draw separator lines between subtrack rows

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: showLegend

Draw the source color key in overlay mode

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: posColor

Fill color for positive scores, used when useBicolor is true (the default)

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'#0068d1'`

#### slot: negColor

Fill color for negative scores, used when useBicolor is true (the default)

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'#e01e26'`

#### slot: bicolorPivot

Pivot value for bicolor mode

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `0` ·
_advanced_

#### slot: minScore

Fixed minimum score bound. The default (Number.MIN_VALUE) is a sentinel meaning
"unset, use autoscale"

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`Number.MIN_VALUE` · _advanced_

#### slot: maxScore

Fixed maximum score bound. The default (Number.MAX_VALUE) is a sentinel meaning
"unset, use autoscale"

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`Number.MAX_VALUE` · _advanced_

#### slot: scaleType

Scale type (linear or log)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`linear`, `log`) · **Default:** `'linear'`

#### slot: autoscale

Autoscale type: "local" uses the min/max in the visible region, "localsd" uses
mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th
percentile score as the max (robust to skewed/peaky data)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`local`, `localsd`, `localpercentile`) · **Default:** `'localpercentile'`

#### slot: numStdDev

Number of standard deviations to use for the localsd autoscale type

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `3` ·
_advanced_

#### slot: numQuantile

Percentile used to clip outliers for the localpercentile autoscale type (e.g.
0.99 clips the outermost 1% of each sign). Positive and negative extents are
computed independently and anchored at 0, so a sparse minority tail (e.g. phyloP
acceleration) stays visible; all-positive data pins the min at 0

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`0.99` · _advanced_

#### slot: scatterPointSize

Point height in px for scatterplot ("scatter"/"multiscatter") rendering. Unset
(the default) follows the session-wide default for this display type, falling
back to 2

**Type:** `maybeNumber` · **Default:** `undefined` · **Resolves to:** `2` ·
_advanced, promotable_

#### slot: lineWidth

Line thickness in px for line ("line"/"multiline") rendering. Unset (the
default) follows the session-wide default for this display type, falling back to
1

**Type:** `maybeNumber` · **Default:** `undefined` · **Resolves to:** `1` ·
_advanced, promotable_

</details>
