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
`strand`, where the alignments display paints one fill. A string is the
constant, `{ value, scale: 'none' }`, so the default field does not hide it.

## Related links

- **Base config:** [AlignmentsColor](../alignmentscolor)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LGVSyntenyColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'strand'</code> | `strand`, `mapq` and `mateRefName` (the query contig) are the fields a synteny block answers. |
| <span class="slot-group">Inherited from [AlignmentsColor](../alignmentscolor)</span> | <span class="slot-group-count">9 slots</span> |
| <span id="slot-value">**value**</span><br>`maybeColor` | The fill of every read while no field paints, and of a read carrying no value under a tag or attribute. Writing `color: "steelblue"` lands here. Unset, the theme's read colour. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, threshold) | none paints value and keeps the field for a switch back; categorical a range colour per value; linear a ramp over a numeric tag or attribute between domainMin and domainMax; threshold the bins domain cuts; unset, threshold over insertSize and insertSizeAndOrientation and categorical over any other field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | for a categorical scale, the values that take the range first, in order; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours a categorical scale hands its domain in order, a threshold scale its bins, or a linear scale's stops, evenly spaced; empty is the tag palette or viridis |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it |
