---
id: alignmentscolor
title: AlignmentsColor
description: "The alignments displays' encoding.color: one color for every read in value, or a field of each read."
sidebar_label: Display setting -> AlignmentsColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsColorConfigSchema.ts).

The alignments displays' `encoding.color`: one color for every read in
`value`, or a field of each read. A preset field, listed below, colors by
its levels or bins, `tags.XX` reads a SAM tag, and any other name reads
the read as a facet over it does: `mateAssembly`, a feature attribute, a
dotted path into one or a `jexl:` expression. A string is the field.
`split`, `spliced`, `pairing` and `svSignal` color nothing: reads keep their
arcs' colors, and a facet sections them by those.
The per-base layer over the reads is `pileup.bases`.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', encoding: { color: 'strand' } }
```

```js
{
  type: 'LinearAlignmentsDisplay',
  encoding: {
    color: {
      field: 'tags.HP',
      scale: {
        domain: ['1', '2'],
        range: ['#d95f02', '#1b9e77'],
        names: ['Maternal', 'Paternal'],
        invalid: '#cccccc',
      },
    },
  },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  encoding: {
    color: { field: 'tags.NM', scale: { type: 'linear', scheme: 'viridis' } },
  },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  encoding: { color: { field: 'insertSize', scale: { domain: [150, 600] } } },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  encoding: {
    color: {
      field: 'pairOrientation',
      scale: { domain: ['RR'], range: ['#d95f02'] },
    },
  },
}
```

## Related links

- **Extended by:** [LGVSyntenyColor](../lgvsyntenycolor)

## Preset fields

A `field` named here paints through its own scale while `scale.type` is unset, and `range` and `names` index its levels in order while `domain` is unwritten. Any other field is ordinal.

<!-- prettier-ignore -->
| Field | Scale | Levels | Names | Other defaults |
| --- | --- | --- | --- | --- |
| `strand` | ordinal | `1`, `-1` |  |  |
| `mapq` | threshold | `1`, `10`, `30` | MAPQ 0 (multi-mapping), MAPQ 1-9 (low), MAPQ 10-29, MAPQ 30+ (high confidence) | `scheme: cividis`; key "Mapping quality" |
| `insertSize` | threshold |  |  |  |
| `firstOfPairStrand` | ordinal | `1`, `-1` |  |  |
| `pairOrientation` | ordinal | `LR`, `RL`, `RR`, `LL`, `''`, `unmappedMate`, `interchrom`, `splitInverted`, `splitSameStrand`, `segmentInverted`, `segmentSameStrand` |  |  |
| `insertSizeAndOrientation` | threshold |  |  |  |
| `mateRefName` | ordinal |  |  |  |

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The fill of every read while no field paints. Arcs and pair orientations keep the theme's colors. Unset, the theme's read color. |
| <span id="slot-scale">**scale**</span><br>[AlignmentsColorScale sub-schema](#slot-scaleinvalid) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-scaleinvalid">**scale.invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The fill of a read with no value under the field, Vega-Lite's word for a missing value's output: no tag, no attribute, or no mate under `mateRefName`. A `''` in `domain` colors it by its `range` entry instead. |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The fill of a read whose tag, attribute, mate reference or MAPQ an ordinal `domain` leaves out, d3's `ordinal.unknown`: `unknown: "#999"` beside `domain: ["1", "2"]` on `tags.HP` paints every other haplotype grey, and the key lists them as one row, Other. A field with fixed levels, such as strand, has no value outside them. |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | Names for each level or value `range` colors, in the same order, in the key, the hovers and the arc key: `names: ["Maternal", "Paternal"]` beside `domain: ["1", "2"]` on `tags.HP`. |
| <span id="slot-legend">**legend**</span><br>[AlignmentsColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | field to color each read by: a preset field by its levels or bins; tags.XX reads a SAM tag; any other name reads as a facet over it does: mateAssembly, a feature attribute, a dotted path or a jexl: expression; split, spliced, pairing and svSignal color nothing, as a facet sections by them |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (ordinal, linear, threshold) | ordinal a range color per value; linear a ramp over mapq or a numeric tag or attribute between domainMin and domainMax; threshold the bins domain cuts; unset, threshold over insertSize, insertSizeAndOrientation and mapq, and ordinal over any other field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | for an ordinal scale, the values that take the range first, in order: a preset field's levels, insertSize's short, normal and long, with unmappedMate and interchrom under both insert-size fields, '' a read with no value, a MAPQ, 255 for unavailable, or a tag's values; for a threshold scale, the cut points, which over insertSize are the two between short, normal and long, where the sampled distribution otherwise sets them |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors an ordinal scale hands its domain in order, or with no domain a preset field's levels in their preset order, a threshold scale its bins, or a linear scale's stops, evenly spaced; a level left out keeps its default; empty uses the field's default colors, cividis over mapq's bins, the tag palette or viridis |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a ramp scale runs along it, a threshold that writes cuts takes one color per interval from end to end, and an ordinal scale that lists a domain one per value; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainquantile">**scale.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
