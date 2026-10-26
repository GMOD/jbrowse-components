---
id: multiwaygenecolor
title: MultiWayGeneColor
description: "The multi-way synteny display's gene encoding.color: a CSS color or jexl: callback in value, or a field whose values each take a range color, or whose numbers each take the color of the interval…"
sidebar_label: Display setting -> MultiWayGeneColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneColorConfigSchema.ts).

The multi-way synteny display's gene `encoding.color`: a CSS color or
`jexl:` callback in `value`, or a field whose values each take a range
color, or whose numbers each take the color of the interval between cut
points they fall in, with a key. A string is the field.

## Example usage

```js
{ type: 'MultiWaySyntenyDisplay', encoding: { color: 'cluster' } }
```

```js
{ type: 'MultiWaySyntenyDisplay', encoding: { color: { value: 'teal' } } }
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

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | A CSS color, or a jexl callback over `feature` returning one; unset, goldenrod.<br>_callback args:_ `feature` |
| <span id="slot-scale">**scale**</span><br>[MultiWayGeneColorScale sub-schema](#slot-scaletype) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>[MultiWayGeneColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each take one range color, with a key; cluster paints a gene, or a placement box, by its ortholog group |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; unset follows field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain: unset takes the next palette color where the display deals one, a color paints that color, "" adds no color from this setting, so a row keeps the color it already has, a variant cell takes the alt hue and a feature the no-value grey |
| <span id="slot-scaleinvalid">**scale.invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a feature with no value under an ordinal scale's field; unset, the display's no-value color |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
