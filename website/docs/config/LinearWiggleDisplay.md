---
id: linearwiggledisplay
title: LinearWiggleDisplay
sidebar_label: Display -> LinearWiggleDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts).

## Example usage

Minimal `QuantitativeTrack` config. See the
[quantitative track guide](/docs/config_guides/quantitative_track) for all
adapter and display options:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
}
```

Taller track, log scale, custom color:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displayDefaults: {
    height: 200,
    scaleType: 'log',
    color: 'darkgreen',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

configuration for the wiggle (quantitative/numeric) display showing XY plot,
density, line, or scatter renderings

These are display-level slots: set them inside a track's `displays` to change
its defaults (setting them at the track top level has no effect). The object
shorthand `displayDefaults: { key: value }` is equivalent to the full
`displays: [{ type: 'LinearWiggleDisplay', displayId: '...', key: value }]`
array form — see
[configuring displays](/docs/config_guides/tracks#configuring-displays).

## Related links

- **Adapter:** [BedGraphAdapter](../bedgraphadapter)
- **Adapter:** [BedGraphTabixAdapter](../bedgraphtabixadapter)
- **Adapter:** [GCContentAdapter](../gccontentadapter)
- **Adapter:** [BigWigAdapter](../bigwigadapter)
- **State model:** [runtime API](../../models/linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type                                                      | Description                                                                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [defaultRendering](#slot-defaultrendering) | `stringEnum` (xyplot, density, line, linecenter, scatter) | Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.                                                                                                                                         |
| [height](#slot-height)                     | `number`                                                  | Default height of the track                                                                                                                                                                                              |
| [useBicolor](#slot-usebicolor)             | `boolean`                                                 | When true (the default), positive scores use posColor and negative use negColor; when false, all bars use the single color slot.                                                                                         |
| [color](#slot-color)                       | `color`                                                   | Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per feature, so jexl callbacks do not apply.                                                                                                  |
| [summaryScoreMode](#slot-summaryscoremode) | `stringEnum` (max, min, avg, whiskers)                    | choose whether to use max/min/average or whiskers which combines all three into the same rendering                                                                                                                       |
| [posColor](#slot-poscolor)                 | `color`                                                   | Fill color for positive scores, used when useBicolor is true (the default)                                                                                                                                               |
| [negColor](#slot-negcolor)                 | `color`                                                   | Fill color for negative scores, used when useBicolor is true (the default)                                                                                                                                               |
| [scaleType](#slot-scaletype)               | `stringEnum` (linear, log)                                | Scale type (linear or log)                                                                                                                                                                                               |
| [autoscale](#slot-autoscale)               | `stringEnum` (local, localsd, localpercentile)            | Autoscale type: "local" uses the min/max in the visible region, "localsd" uses mean ± numStdDev standard deviations, "localpercentile" uses the numQuantile-th percentile score as the max (robust to skewed/peaky data) |

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
<summary>LinearWiggleDisplay - Slots</summary>

#### slot: defaultRendering

Default rendering type: `xyplot`, `density`, `line`, `linecenter`, or `scatter`.

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`xyplot`, `density`, `line`, `linecenter`, `scatter`) · **Default:** `'xyplot'`

**Example:**

```json
{
  "type": "LinearWiggleDisplay",
  "defaultRendering": "density"
}
```

#### slot: height

Default height of the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: useBicolor

When true (the default), positive scores use posColor and negative use negColor;
when false, all bars use the single color slot. Setting color alone, with no
posColor/negColor/useBicolor, turns this off for you.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: color

Single fill CSS color for the wiggle bars; a wiggle colors per signal, not per
feature, so jexl callbacks do not apply. Set alone it implies useBicolor false;
alongside posColor/negColor it goes unused. Density rendering always draws from
posColor.

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'#0068d1'`

#### slot: minimalTicks

Draw only the min/max Y-axis ticks

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: summaryScoreMode

choose whether to use max/min/average or whiskers which combines all three into
the same rendering

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`max`, `min`, `avg`, `whiskers`) · **Default:** `'whiskers'`

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
