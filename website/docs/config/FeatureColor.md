---
id: featurecolor
title: FeatureColor
description: "The canvas feature displays' encoding.color: a CSS color or jexl: callback in value, or a field whose values each take a range color, whose numbers each take the color of the interval between cut…"
sidebar_label: Display -> FeatureColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/colorConfigSchema.ts).

The canvas feature displays' `encoding.color`: a CSS color or `jexl:`
callback in `value`, or a field whose values each take a range color, whose
numbers each take the color of the interval between cut points they fall
in, or whose numbers run along a color ramp, with a key. A string is the
field; a written field always paints. `scale.type: "identity"` keeps each
feature's color, whether a file's itemRgb or what a `value` callback
returns, and names the colors `scale.domain` lists in the key. Like UCSC's
`itemRgb on`, it paints an itemRgb of `0,0,0` or `0` black, which otherwise
reads as no color, and reads a comma-free itemRgb as a packed integer.

## Example usage

```js
{ type: 'LinearBasicDisplay', encoding: { color: { value: 'goldenrod' } } }
```

```js
{
  type: 'LinearBasicDisplay',
  encoding: {
    color: { field: 'gene_biotype', scale: { range: ['#1f77b4', '#ff7f0e'] } },
  },
}
```

```js
{
  type: 'LinearBasicDisplay',
  encoding: {
    color: {
      field: 'type',
      scale: {
        domain: ['prophage', 'plasmid'],
        range: ['#d95f02', '#1b9e77'],
        unknown: '#cccccc',
      },
    },
  },
}
```

```js
{
  type: 'LinearBasicDisplay',
  encoding: {
    color: {
      field: 'score',
      scale: {
        type: 'threshold',
        domain: [0.5, 0.9],
        range: ['#c6dbef', '#6baed6', '#08519c'],
      },
    },
  },
}
```

```js
{
  type: 'LinearBasicDisplay',
  encoding: { color: { field: 'score', scale: { scheme: 'viridis', domainMin: 0 } } },
}
```

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  encoding: {
    color: {
      scale: {
        type: 'identity',
        domain: ['rgb(255,0,0)', 'rgb(0,128,0)'],
        names: ['Active TSS', 'Strong transcription'],
      },
    },
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | A CSS color, or a jexl callback over `feature` returning one. Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod. Alignments' `value` is constant-only; here a callback stays, since the worker evaluates it per box, where a `field` reads the transcript.<br>_callback args:_ `feature` |
| <span id="slot-scale">**scale**</span><br>[FeatureColorScale sub-schema](#slot-scaletype) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>[FeatureColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each take one range color, with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless scale.domain or scale.range says otherwise |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; linear or log a color along a ramp from domainMin to domainMax; identity paints each feature's own color, as a channel with no field does, except that an itemRgb of 0,0,0 or 0 paints black and a comma-free one reads as a packed integer, and the key names the colors in domain; unset is linear for score and ordinal for any other field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it. Under identity, the CSS colors the key names, in order |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts, an interval left out sampling the default ramp; under linear or log the ramp's stops, winning over scheme |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain: unset takes the next palette color where the display deals one, a color paints that color, "" adds no color from this setting, so a row keeps the color it already has, a variant cell takes the alt hue and a feature the no-value grey |
| <span id="slot-scaleinvalid">**scale.invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a feature with no value under an ordinal scale's field; unset, the display's no-value color |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a linear, log or symlog scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainquantile">**scale.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
