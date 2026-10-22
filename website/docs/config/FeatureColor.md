---
id: featurecolor
title: FeatureColor
description: "The canvas feature displays' color setting: a CSS color or jexl: callback in value, or a field whose values each take a range color, whose numbers each take the color of the interval between cut…"
sidebar_label: Display -> FeatureColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/colorConfigSchema.ts).

The canvas feature displays' `color` setting: a CSS color or `jexl:`
callback in `value`, or a field whose values each take a range color,
whose numbers each take the color of the interval between cut points they
fall in, or whose numbers run along a color ramp, with a key. A string is
the constant; the object binds the field, which paints wherever one is
written. `scale: "identity"` keeps each feature's color, whether a file's itemRgb or
what a `value` callback returns, and names the colors `domain` lists in the
key. Like UCSC's `itemRgb on`, it paints an itemRgb of `0,0,0` or `0` black,
which otherwise reads as no color, and reads a comma-free itemRgb as a packed
integer.

## Example usage

```js
{ type: 'LinearBasicDisplay', color: 'goldenrod' }
```

```js
{
  type: 'LinearBasicDisplay',
  color: { field: 'gene_biotype', range: ['#1f77b4', '#ff7f0e'] },
}
```

```js
{
  type: 'LinearBasicDisplay',
  color: {
    field: 'type',
    domain: ['prophage', 'plasmid'],
    range: ['#d95f02', '#1b9e77'],
    unknown: '#cccccc',
  },
}
```

```js
{
  type: 'LinearBasicDisplay',
  color: {
    field: 'score',
    scale: 'threshold',
    domain: [0.5, 0.9],
    range: ['#c6dbef', '#6baed6', '#08519c'],
  },
}
```

```js
{
  type: 'LinearBasicDisplay',
  color: { field: 'score', scheme: 'viridis', domainMin: 0 },
}
```

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  color: {
    scale: 'identity',
    domain: ['rgb(255,0,0)', 'rgb(0,128,0)'],
    labels: ['Active TSS', 'Strong transcription'],
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The heading of the key this scale draws, naming what the color measures. Three states: unset, the key keeps the display's own heading, usually the field's name; some text is that text; `""` is a key with no title, and the only spelling of one. `null` reads as unset, as it does in every slot. |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | A CSS color, or a jexl callback over `feature` returning one. Writing `color: "red"` or `color: "jexl:…"` lands here. Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each take one range color, with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless domain or range says otherwise |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | categorical a range color per value of field; threshold a range color per interval between the cut points in domain; linear or log a color along a ramp from domainMin to domainMax; identity paints each feature's own color, as an object with no field does, except that an itemRgb of 0,0,0 or 0 paints black and a comma-free one reads as a packed integer, and the key names the colors in domain; unset is linear for score and categorical for any other field |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it. Under identity, the CSS colors the key names, in order |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts; under linear or log the ramp's stops, winning over scheme |
| <span id="slot-unknown">**unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain: unset takes the next palette color where the display deals one, a color paints that color, "" adds no color from this setting, so a row keeps the color it already has, a variant cell takes the alt hue and a feature the no-value grey |
| <span id="slot-labels">**labels**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | key label for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its name |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a linear, log or symlog scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-domainquantile">**domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
