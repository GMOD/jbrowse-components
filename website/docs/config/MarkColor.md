---
id: markcolor
title: MarkColor
description: "A mark's encoding.color: one CSS color or jexl: callback for every instance in value, or a field through scale, Vega-Lite's scale object: an ordinal scale (a range color per value), a linear, log or…"
sidebar_label: Display -> MarkColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markColorConfigSchema.ts).

A mark's `encoding.color`: one CSS color or `jexl:` callback for every
instance in `value`, or a `field` through `scale`, Vega-Lite's scale
object: an ordinal scale (a `range` color per value), a `linear`, `log` or
`symlog` scale (a ramp between `domainMin` and `domainMax`, `domainMid`
placing its middle stop where a diverging ramp turns; `symlog` runs
logarithmic away from 0 and linear through it, so a signed fold change
ramps on both sides) or a `threshold` scale (a `range` color per interval
between the cut points `domain` lists). A string is the field, as every
channel's is inside `encoding`; a constant is `{ value }`. `legend` shapes
the key the scale draws.

## Example usage

```js
{ mark: 'bar', encoding: { y: 'score', color: { value: 'steelblue' } } }
```

```js
{ mark: 'point', encoding: { y: 'score', color: 'type' } }
```

```js
{
  mark: 'point',
  encoding: {
    y: 'score',
    color: { field: 'strand', scale: { domain: ['1', '-1'] } },
  },
}
```

```js
{
  mark: 'span',
  encoding: {
    color: {
      field: 'score',
      scale: {
        type: 'log',
        domainMin: 1,
        domainMax: 1000,
        range: ['white', 'red'],
      },
    },
  },
}
```

```js
{
  mark: 'bar',
  encoding: {
    y: 'score',
    color: {
      field: 'score',
      scale: {
        type: 'linear',
        domainMin: -2,
        domainMax: 6,
        domainMid: 0,
        range: ['blue', 'white', 'red'],
      },
    },
  },
}
```

```js
{
  mark: 'point',
  encoding: {
    y: 'score',
    color: {
      field: 'pip',
      scale: {
        type: 'threshold',
        domain: [0.1, 0.5],
        range: ['#357ebd', '#eea236', '#d43f3a'],
      },
      legend: { title: 'PIP', descending: true },
    },
  },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | A CSS color, or a jexl callback over `feature` returning one, for a mark whose color is not a scale. Unset, a mark paints in the default blue, `#0068d1`, and a text mark prints in the page's text color.<br>_callback args:_ `feature` |
| <span id="slot-scale">**scale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'MarkColorScale', { ...colorScaleTypeSlot(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'MarkColorScale',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;...colorScaleTypeSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;scales: MARK_COLOR_SCALES,&#10;&#160;&#160;&#160;&#160;&#160;&#160;scaleName: 'MarkColorScaleType',&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'ordinal hands out range colors per distinct value; linear, log and symlog read the value between domainMin and domainMax into a ramp; threshold cuts the value at the domain and hands each interval a range color; unset is linear for score and ordinal for any other field',&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorDomainSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;domain:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'for an ordinal scale, the values in legend order, walking the range from the first entry and continuing into the default palette past its end (a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it); for a threshold scale, the cut points in ascending order, a value taking the range entry for the number of them it is at or past, so range has one entry more than this; a linear or log scale reads domainMin and domainMax instead',&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorDomainEndsSlots,&#10;&#160;&#160;&#160;&#160;...colorDomainQuantileSlot,&#10;&#160;&#160;&#160;&#160;...colorRangeSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;range:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;"CSS colors an ordinal scale hands its domain in order, a threshold scale its intervals, or a ramp's evenly spaced stops; empty is the default palette, or the scheme",&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorUnknownSlot,&#10;&#160;&#160;&#160;&#160;...colorNamesSlot,&#10;&#160;&#160;&#160;&#160;...colorRampSlots,&#10;&#160;&#160;},&#10;&#160;&#160;colorScaleOptions('encoding.color.scale'),&#10;)</code></pre></dialog></span> | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'MarkColorLegend', { ...colorTitleSlot, ..…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'MarkColorLegend',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;...colorTitleSlot,&#10;&#160;&#160;&#160;&#160;...colorDescendingSlot,&#10;&#160;&#160;&#160;&#160;values: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'stringArray',&#10;&#160;&#160;&#160;&#160;&#160;&#160;defaultValue: [],&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'values the key lists; empty lists every value met',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;missingLabel: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeString',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description: 'key row for a feature with no value',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;&#160;&#160;markLegendOptions,&#10;)</code></pre></dialog></span> | The key this channel's scale draws. |
| <span id="slot-values">**values**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The values an ordinal key lists, in this order; empty lists every value the loaded regions met. A value left out still paints, as Vega-Lite's `legend.values` and ggplot2's `breaks` leave it. |
| <span id="slot-missinglabel">**missingLabel**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The key's name for a feature with nothing in `field`; unset is "(no value)". Vega-Lite's legend has no such member, so it keeps its JBrowse name. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | the feature field a scale reads, or a jexl expression over feature, which is slower per feature and so the opt-in |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (ordinal, linear, log, symlog, threshold) | ordinal hands out range colors per distinct value; linear, log and symlog read the value between domainMin and domainMax into a ramp; threshold cuts the value at the domain and hands each interval a range color; unset is linear for score and ordinal for any other field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | for an ordinal scale, the values in legend order, walking the range from the first entry and continuing into the default palette past its end (a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it); for a threshold scale, the cut points in ascending order, a value taking the range entry for the number of them it is at or past, so range has one entry more than this; a linear or log scale reads domainMin and domainMax instead |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainquantile">**scale.domainQuantile**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the quantile an open end of a ramp follows over the loaded values: 1 their extremes, 0.99 clips the outermost 1% at each end, each sign measured on its own<br>_advanced_ |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors an ordinal scale hands its domain in order, a threshold scale its intervals, or a ramp's evenly spaced stops; empty is the default palette, or the scheme |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain: unset takes the next palette color where the display deals one, a color paints that color, "" adds no color from this setting, so a row keeps the color it already has, a variant cell takes the alt hue and a feature the no-value grey |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a linear, log or symlog scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
