---
id: variantcellcolor
title: VariantCellColor
description: "The variant display's encoding.color: the hue of every genotype cell with an alt allele, which shadeByDosage then lightens for a heterozygote. Unset, the cells paint the genotype colors."
sidebar_label: Display setting -> VariantCellColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/cellColorConfigSchema.ts).

The variant display's `encoding.color`: the hue of every
genotype cell with an alt allele, which `shadeByDosage` then lightens for a
heterozygote. Unset, the cells paint the genotype colors. A CSS color or
`jexl:` callback in `value` paints every alt cell of a variant; a `field`
gives each of its values a color with a key. Three fields are presets:
`impact`, the most severe SnpEff/VEP consequence tier; `svType`, the
structural-variant class; `phaseSet`, the FORMAT PS block, in phased mode.
Any other field is read off the record — `INFO.CLNSIG`, `QUAL`, or a
`jexl:` expression — and a numeric one cut into intervals by a `threshold`
scale or run along a `linear` or `log` ramp. A string is the field.
`scale.type: "identity"` keys a `value` callback's colors: each variant
paints the color it returns, and the key names the colors `scale.domain`
lists, as on a feature track. The records band paints what the cells
paint, so one channel colors both.

## Example usage

```js
{ type: 'LinearVariantDisplay', encoding: { color: 'impact' } }
```

```js
{
  type: 'LinearVariantDisplay',
  encoding: {
    color: {
      value: "jexl:get(feature,'INFO').COLOR",
      scale: {
        type: 'identity',
        domain: ['#d73027', '#4575b4'],
        names: ['Pathogenic', 'Benign'],
      },
    },
  },
}
```

```js
{
  type: 'LinearVariantDisplay',
  encoding: {
    color: {
      field: 'INFO.AF',
      scale: {
        type: 'threshold',
        domain: [0.001, 0.01, 0.05],
        range: ['#b2182b', '#ef8a62', '#67a9cf', '#2166ac'],
      },
    },
  },
}
```

## Preset fields

A `field` named here paints through its own scale while `scale.type` is unset, and `range` and `names` index its levels in order while `domain` is unwritten. Any other field is ordinal.

<!-- prettier-ignore -->
| Field | Scale | Levels | Names | Other defaults |
| --- | --- | --- | --- | --- |
| `strand` | ordinal | `1`, `-1`, `0` | Forward strand, Reverse strand, No strand | `range`: `tomato`, `cornflowerblue`, `goldenrod` |
| `svType` | ordinal | `DEL`, `DUP`, `INS`, `INV`, `CNV`, `TR`, `BND`, `CPX`, `OTHER` | Deletion, Duplication, Insertion, Inversion, Copy-number variable, Tandem repeat, Breakend / translocation, Complex, Other / mixed | `range`: `#e41a1c`, `#377eb8`, `#800080`, `#ff7f00`, `#7e6148`, `#e7298a`, `#17becf`, `#66a61e`, `#000000`; key "SV type" |
| `impact` | ordinal | `HIGH`, `MODERATE`, `LOW`, `MODIFIER`, `Unannotated` |  | `range`: `#d32f2f`, `#f57c00`, `#fbc02d`, `#9e9e9e`, `#607d8b`; key "Consequence impact" |
| `score` | linear |  |  |  |

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | A CSS color, or a jexl callback over `feature` returning one, for every alt cell of the variant. Unset, the cells paint the genotype colors.<br>_callback args:_ `feature` |
| <span id="slot-scale">**scale**</span><br>[VariantCellColorScale sub-schema](#slot-scaletype) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>[VariantCellColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | impact, the most severe SnpEff/VEP consequence tier; svType, the structural-variant class; phaseSet, the FORMAT PS block in phased mode; or any record field, INFO.CLNSIG say, or a jexl expression over feature, whose values each paint one range color with a key. A record with no value keeps the default alt color |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; linear or log a color along a ramp from domainMin to domainMax; identity paints each variant the color its value callback returns, as a callback with no scale does, and the key names the colors in domain; unset is linear for score and ordinal for any other field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values that take the range first, in order; under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts; under linear or log the ramp's stops, winning over scheme |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain. Unset: the next palette color where the display deals one, and the levels a preset field names, such as strand's, keep their own colors. A color: that color. "": no color dealt, so a feature paints the no-value grey, a variant cell the alt hue, and a row keeps the color it already has |
| <span id="slot-scaleinvalid">**scale.invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a feature with no value under an ordinal scale's field; unset, the display's no-value color |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a ramp scale runs along it, a threshold that writes cuts takes one color per interval from end to end, and an ordinal scale that lists a domain one per value; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainquantile">**scale.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
