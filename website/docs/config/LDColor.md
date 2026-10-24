---
id: ldcolor
title: LDColor
description: "The LD display's encoding.color paints the statistic the cells show, r2 or dprime, through a linear scale onto a named scale.scheme. An unset scheme is the metric's own, reds for r² and blues for D'."
sidebar_label: Display -> LDColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/ldColorConfigSchema.ts).

The LD display's `encoding.color` paints the statistic the cells show,
`r2` or `dprime`, through a linear scale onto a named `scale.scheme`. An
unset scheme is the metric's own, reds for r² and blues for D'. The domain
is the statistic's 0 to 1 rather than the loaded values', so one r² paints
one color on every track; `scale.domainMin` and `scale.domainMax` narrow
it. The slots are the shared color channel's, so `jbrowse validate` and
"Edit plot..." judge them as they judge any other display's. A string is
the field.

## Example usage

```js
{
  type: 'LDTrackDisplay',
  encoding: {
    color: { field: 'dprime', scale: { scheme: 'viridis', domainMin: 0.2 } },
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (r2, dprime) = <code>'r2'</code> | The file column the cells show: `r2` (R², the R2/PHASED_R2 column) or `dprime` (D', the DP/ABS_DPRIME one). A file with only one of the two uses that one whichever is asked for, and the legend and the menu show which. |
| <span id="slot-scale">**scale**</span><br>[LDColorScale sub-schema](#slot-scalescheme) | The ramp the statistic runs along, Vega-Lite's scale object. |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | the named ramp the statistic runs across; unset is the field's own, reds for r2 and blues for dprime |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset turns round viridis, magma, inferno and cividis, which run dark at their low end, since an unpainted cell is the page behind the matrix. |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the bottom color paints, everything below it too; unset is 0 |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the top color paints, everything above it too; unset is 1 |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear) | linear, the one scale; unset is linear |
