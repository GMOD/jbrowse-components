---
id: lgvsyntenycolor
title: LGVSyntenyColor
sidebar_label: Display -> LGVSyntenyColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyColorConfigSchema.ts).

## Example usage

```js
{ type: 'LGVSyntenyDisplay', color: { field: 'mateRefName' } }
```

_See the **Config slots** section below for all available configuration fields._

The LGVSyntenyDisplay's `color` setting: the
[AlignmentsColor](../alignmentscolor) object with `field` defaulting to
`strand`, where the alignments display paints one fill.

## Related links

- **Base config:** [AlignmentsColor](../alignmentscolor)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LGVSyntenyColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'strand'</code> | `strand`, `mapq` and `mateRefName` (the query contig) are the fields a synteny block answers. |
| <span class="slot-group">Inherited from [AlignmentsColor](../alignmentscolor)</span> | <span class="slot-group-count">6 slots</span> |
| <span id="slot-value">**value**</span><br>`maybeColor` | The fill of every read while no field paints, and of a read carrying no value under a tag or attribute. Writing `color: "steelblue"` lands here. Unset, the theme's read colour. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, threshold) | none paints value and keeps the field for a switch back; categorical a palette colour per value; linear a ramp over a numeric tag or attribute; threshold the bins domain cuts; unset follows field, and under a tag or attribute is linear with a ramp and categorical without |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the values that take the palette first, in order; under insertSize the two cut points between short, normal and long, where the sampled distribution otherwise sets them; under linear the ramp's two ends, where the loaded reads otherwise set them |
| <span id="slot-palette">**palette**</span><br>`stringArray` = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end |
| <span id="slot-ramp">**ramp**</span><br>`stringArray` = <code>[]</code> | viridis, or two or more CSS colour stops; empty is viridis |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it |
