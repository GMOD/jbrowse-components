---
id: ldcolor
title: LDColor
description: "The LD display's encoding.color paints the statistic the cells show, r2 or dprime, through a linear scale onto a named scale.scheme. An unset scheme is the metric's own, reds for r² and blues for D'."
sidebar_label: Display setting -> LDColor
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/ldColorConfigSchema.ts).

The LD display's `encoding.color` paints the statistic the cells show,
`r2` or `dprime`, through a linear scale onto a named `scale.scheme`. An
unset scheme is the metric's own, reds for r² and blues for D'. The domain
is the statistic's 0 to 1 rather than the loaded values', so one r² paints
one color on every track; `scale.domainMin` and `scale.domainMax` narrow
it. A `threshold` scale paints each interval between its `domain` cuts one
`range` color instead, so the triangle can take the bins a GWAS track's LD
coloring uses. The slots are the shared color channel's, so
`jbrowse validate` and "Edit plot..." judge them as they judge any other
display's. A string is the field. There is no `value`: every cell paints
its statistic through `MatrixRampMixin`'s ramp, which has no constant
color.

## Example usage

```js
{
  type: 'LDTrackDisplay',
  encoding: {
    color: { field: 'dprime', scale: { scheme: 'viridis', domainMin: 0.2 } },
  },
}
```

LocusZoom's r² bins, the GWAS track's, highest first in the key:

```js
{
  type: 'LDTrackDisplay',
  encoding: {
    color: {
      field: 'r2',
      scale: {
        type: 'threshold',
        domain: [0.2, 0.4, 0.6, 0.8],
        range: ['#357ebd', '#46b8da', '#5cb85c', '#eea236', '#d43f3a'],
      },
      legend: { descending: true },
    },
  },
}
```

## Preset fields

A `field` named here paints through its own scale while `scale.type` is unset, and `range` and `names` index its levels in order while `domain` is unwritten.

<!-- prettier-ignore -->
| Field | Scale | Levels | Names | Other defaults |
| --- | --- | --- | --- | --- |
| `r2` | linear |  |  | `scheme: reds`; key "R²" |
| `dprime` | linear |  |  | `scheme: blues`; key "D'" |

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (r2, dprime) = <code>'r2'</code> | The file column the cells show: `r2` (R², the R2/PHASED_R2 column) or `dprime` (D', the DP/ABS_DPRIME one). A file with only one of the two uses that one whichever is asked for, and the legend and the menu show which. |
| <span id="slot-scale">**scale**</span><br>[LDColorScale sub-schema](#slot-scaletype) | The ramp the statistic runs along, or the intervals it is cut into, Vega-Lite's scale object. `range` colors a threshold's intervals only: `MatrixRampMixin` builds the ramp from `scheme` and `reverse` alone (Colin, 2026-10-30). |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear, threshold) | linear, the default, runs the statistic along the scheme; threshold paints each interval between the domain's cuts one range color |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | a threshold scale's cuts, each the lowest value of the interval above it |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | a threshold scale's colors, one per interval from the lowest; an interval left unnamed samples the scheme |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | the named ramp the statistic runs across; unset is the field's own, reds for r2 and blues for dprime |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset turns round viridis, magma, inferno and cividis, which run dark at their low end, since an unpainted cell is the page behind the matrix. |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the bottom color paints, everything below it too; unset is 0 |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the top color paints, everything above it too; unset is 1 |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the ramp's middle stop sits at; unset, the stops spread evenly across the domain. |
| <span id="slot-legend">**legend**</span><br>[LDColorLegend sub-schema](#slot-legenddescending) | The key this channel draws: `title` replaces the metric's name, and `""` draws none; `descending` lists a threshold's intervals highest first. |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
