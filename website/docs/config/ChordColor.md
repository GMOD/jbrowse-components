---
id: chordcolor
title: ChordColor
description: "A variant chord's encoding.color: a CSS color or jexl: callback in value for every chord, or a field of the record whose values each take a range color, with a key on the circle. svType paints the…"
sidebar_label: Display setting -> ChordColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/chordColorConfigSchema.ts).

A variant chord's `encoding.color`: a CSS color or `jexl:` callback in
`value` for every chord, or a `field` of the record whose values each take
a range color, with a key on the circle. `svType` paints the
structural-variant classes the variant displays paint. A string is the
field.

## Example usage

```js
{ type: 'ChordVariantDisplay', encoding: { color: 'svType', opacity: 0.45 } }
```

## Preset fields

A `field` named here paints through its own scale while `scale.type` is unset, and `range` and `names` index its levels in order while `domain` is unwritten. Any other field is ordinal.

<!-- prettier-ignore -->
| Field | Scale | Levels | Names | Other defaults |
| --- | --- | --- | --- | --- |
| `strand` | ordinal | `1`, `-1`, `0` | Forward strand, Reverse strand, No strand | `range`: `tomato`, `cornflowerblue`, `goldenrod` |
| `svType` | ordinal | `DEL`, `DUP`, `INS`, `INV`, `CNV`, `TR`, `BND`, `CPX`, `OTHER` | Deletion, Duplication, Insertion, Inversion, Copy-number variable, Tandem repeat, Breakend / translocation, Complex, Other / mixed | `range`: `#e41a1c`, `#377eb8`, `#800080`, `#ff7f00`, `#7e6148`, `#e7298a`, `#17becf`, `#66a61e`, `#000000`; key "SV type" |
| `impact` | ordinal | `HIGH`, `MODERATE`, `LOW`, `MODIFIER`, `Unannotated` |  | `range`: `#d32f2f`, `#f57c00`, `#fbc02d`, `#9e9e9e`, `#607d8b`; key "Consequence impact" |

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgb(255,133,0)'</code> | A CSS color, or a jexl callback over `feature` returning one, for every chord.<br>_callback args:_ `feature` |
| <span id="slot-scale">**scale**</span><br>[ChordColorScale sub-schema](#slot-scaletype) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>[ChordColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a record field, svType say, or a jexl expression over feature, whose values each paint one range color with a key |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; unset follows field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values that take the range first, in order; under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain. Unset: the next palette color where the display deals one, and the levels a preset field names, such as strand's, keep their own colors. A color: that color. "": no color dealt, so a feature paints the no-value grey, a variant cell the alt hue, and a row keeps the color it already has |
| <span id="slot-scaleinvalid">**scale.invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a feature with no value under an ordinal scale's field; unset, the display's no-value color |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
