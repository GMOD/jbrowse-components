---
id: lgvsyntenycolor
title: LGVSyntenyColor
description: "The LGVSyntenyDisplay's encoding.color: the AlignmentsColor channel, painting strand while it names neither a field nor a constant. strand, mapq and mateRefName (the query contig) are the fields a…"
sidebar_label: Display -> LGVSyntenyColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyColorConfigSchema.ts).

The LGVSyntenyDisplay's `encoding.color`: the
[AlignmentsColor](../alignmentscolor) channel, painting `strand` while it
names neither a field nor a constant. `strand`, `mapq` and `mateRefName`
(the query contig) are the fields a synteny block answers.

## Example usage

```js
{ type: 'LGVSyntenyDisplay', encoding: { color: 'mateRefName' } }
```

## Related links

- **Base config:** [AlignmentsColor](../alignmentscolor)

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span class="slot-group">Inherited from [AlignmentsColor](../alignmentscolor)</span> | <span class="slot-group-count">18 slots</span> |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The fill of every read while no field paints. Arcs and pair orientations keep the theme's colors. Unset, the theme's read color. |
| <span id="slot-scale">**scale**</span><br>[AlignmentsColorScale sub-schema](#slot-scaletype) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-invalid">**invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The fill of a read with no value under the field, Vega-Lite's word for a missing value's output: no tag, no attribute, or no mate under `mateRefName`. A `''` in `domain` colors it by its `range` entry instead. |
| <span id="slot-unknown">**unknown**</span><br><code>{ ...colorUnknownSlot.unknown, }</code> | The fill of a read whose value an ordinal `domain` leaves out, d3's `ordinal.unknown`: `unknown: "#999"` beside `domain: ["1", "2"]` on `tags.HP` paints every other haplotype grey, and the key lists them as one row, Other. |
| <span id="slot-names">**names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | Names for each level or value `range` colors, in the same order, in the key, the hovers and the arc key: `names: ["Maternal", "Paternal"]` beside `domain: ["1", "2"]` on `tags.HP`. |
| <span id="slot-legend">**legend**</span><br>[AlignmentsColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | field to color each read by: strand, firstOfPairStrand, pairOrientation, insertSize, insertSizeAndOrientation and mateRefName color by their fixed levels and mapq by its four bins; tags.XX reads a SAM tag; any other name reads as a facet over it does: mateAssembly, a feature attribute, a dotted path or a jexl: expression; split, spliced, pairing and svSignal color nothing, as a facet sections by them |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (ordinal, linear, threshold) | ordinal a range color per value; linear a ramp over mapq or a numeric tag or attribute between domainMin and domainMax; threshold the bins domain cuts; unset, threshold over insertSize, insertSizeAndOrientation and mapq, and ordinal over any other field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | for an ordinal scale, the values that take the range first, in order: a preset field's levels (strand 1 and -1; pairOrientation LR, RL, RR and LL; insertSize short, normal and long; under the insert-size and orientation fields, unmappedMate and interchrom, and in a chain under the orientation ones splitInverted, splitSameStrand, segmentInverted and segmentSameStrand; '' a read with no value), a MAPQ, 255 for unavailable, or a tag's values; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them, and over mapq 1, 10 and 30 |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors an ordinal scale hands its domain in order, or with no domain a preset field's levels in their preset order, a threshold scale its bins, or a linear scale's stops, evenly spaced; a level left out keeps its default; empty uses the field's default colors, cividis over mapq's bins, the tag palette or viridis |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a linear, log or symlog scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainquantile">**scale.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
