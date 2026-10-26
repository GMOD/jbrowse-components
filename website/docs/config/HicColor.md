---
id: hiccolor
title: HicColor
description: "The Hi-C display's encoding.color: a bin's observed contact count, or its observed/expected or observed/control ratio, through a linear, symlog or log scale.type onto a named scale.scheme."
sidebar_label: Display -> HicColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/hicColorConfigSchema.ts).

The Hi-C display's `encoding.color`: a bin's `observed` contact count, or
its `observed/expected` or `observed/control` ratio, through a `linear`,
`symlog` or `log` `scale.type` onto a named `scale.scheme`.

- `observed`: an unset `scale.domainMax` follows the loaded counts,
  saturating at their `scale.domainQuantile`, the 95th percentile by
  default, or at their maximum at a quantile of 1. Setting it gives every
  zoom, and every track that sets the same number, one scale.
- `observed/expected`: each count over the file's expected count at that
  distance, the view Juicebox calls O/E, which shows compartments and loops
  under the decay of contact with distance. It diverges around 1 from a
  quarter to fourfold, and where the file has no expected values at the
  binsize, the display paints the counts and the key says so.
- `observed/control`: each count over the adapter's `controlAdapter`
  count for the same bins, both scaled to the two libraries' common depth
  and given a pseudocount of 1. A cell only one condition holds draws too,
  so lost and gained contacts both show; on the same ramp as
  observed/expected.

The slots are the shared color channel's, so `jbrowse validate` and "Edit
plot..." judge them as they judge any other display's.

## Example usage

```js
{
  type: 'LinearHicDisplay',
  encoding: {
    color: { scale: { type: 'symlog', scheme: 'viridis', domainMax: 500 } },
  },
}
```

## Preset fields

A `field` named here paints through its own scale while `scale.type` is unset, and `range` and `names` index its levels in order while `domain` is unwritten.

<!-- prettier-ignore -->
| Field | Scale | Levels | Names | Other defaults |
| --- | --- | --- | --- | --- |
| `observed` | linear |  |  | `scheme: juicebox`; key "Contacts" |
| `observed/expected` | log |  |  | `scheme: redblue`; `reverse: true`; `domainMin: 0.25`; `domainMax: 4`; `domainMid: 1`; key "Observed/expected" |
| `observed/control` | log |  |  | `scheme: redblue`; `reverse: true`; `domainMin: 0.25`; `domainMax: 4`; `domainMid: 1`; key "Observed/control" |

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (observed, observed/expected, observed/control) = <code>'observed'</code> | observed, each bin's contact count; observed/expected, that count over the file's expected count at its distance; or observed/control, that count over the control file's, both scaled to one library depth |
| <span id="slot-scale">**scale**</span><br>[HicColorScale sub-schema](#slot-scaletype) | How a bin's value maps to a color, Vega-Lite's scale object. |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear, symlog, log) | linear; symlog, d3's log(1 + count), which the Log scale toggle writes: it lifts sparse long-range bins off the floor, so only 0 paints as the domain's bottom does; or log, log2 of the count from a pinned domainMin or else 1, every bin at or below which paints as the domain's bottom does. Juicebox paints that bottom transparent. Unset is the field's own, linear for observed |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | the named ramp the field runs across; unset is the field's own, juicebox for count, which fades from transparent to red |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset turns round viridis, magma, inferno and cividis, which run dark at their low end, since an unpainted bin is the page behind the matrix; the field's own scheme keeps the field's direction. |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br><code>colorRampSlots.domainMid</code> | The value the ramp's middle stop sits at, so a diverging scheme centres on it and equal distances from it take equal colors; unset, the stops spread evenly across the domain. |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of the scale; unset follows the loaded values, whose extent starts at 0 since no value is below it |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of the scale's domain; unset follows the loaded counts |
| <span id="slot-scaledomainquantile">**scale.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.95</code> | The value an unset `domainMax` follows: the loaded values' quantile, `0.95` so faint off-diagonal contacts read, or at `1` their maximum. The track menu's "Emphasize faint contacts" toggles it. Only the top clips, since the values' extent starts at 0, the way an axis that starts at 0 adds 0 to the shared quantile extent. |
| <span id="slot-legend">**legend**</span><br>[HicColorLegend sub-schema](#slot-legendtitle) | The key this channel draws: `title` replaces the heading naming the field and binsize, and `""` draws none. |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
