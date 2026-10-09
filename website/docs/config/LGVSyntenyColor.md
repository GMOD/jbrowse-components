---
id: lgvsyntenycolor
title: LGVSyntenyColor
description: "The LGVSyntenyDisplay's color setting: the AlignmentsColor object with field defaulting to strand, where the alignments display paints one fill. A string is the constant,…"
sidebar_label: Display -> LGVSyntenyColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyColorConfigSchema.ts).

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

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'strand'</code> | `strand`, `mapq` and `mateRefName` (the query contig) are the fields a synteny block answers. |
| <span class="slot-group">Inherited from [AlignmentsColor](../alignmentscolor)</span> | <span class="slot-group-count">13 slots</span> |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The fill of every read while no field paints, and of a read carrying no value under a tag or attribute, or no mate under `mateRefName`. Arcs and pair orientations keep the theme's colors. Writing `color: "steelblue"` lands here. Unset, the theme's read color. |
| <span id="slot-labels">**labels**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | What the key, the hovers and the arc key name each level or value `range` colors, in the same order: `labels: ["Maternal", "Paternal"]` beside `domain: ["1", "2"]` on `tags.HP`. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, threshold) | none paints value and keeps the field for a switch back; categorical a range color per value; linear a ramp over a numeric tag or attribute between domainMin and domainMax; threshold the bins domain cuts; unset, threshold over insertSize and insertSizeAndOrientation and categorical over any other field |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | for a categorical scale, the values that take the range first, in order: a preset field's own levels (strand 1 and -1; pairOrientation LR, RL, RR and LL; insertSize short, normal and long; mapq 255 for unavailable; '' a read with no value) or a tag's values; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainquantile">**domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a linear or log scale follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors a categorical scale hands its domain in order, or with no domain a preset field's levels in their own order, a threshold scale its bins, or a linear scale's stops, evenly spaced; a level left out keeps its default; empty is the field's own colors, the tag palette or viridis |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue) | a named ramp: a linear or log scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns the ramp round, so its last color paints the bottom of a linear or log domain or a threshold's lowest interval |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-descending">**descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
