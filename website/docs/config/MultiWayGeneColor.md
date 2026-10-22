---
id: multiwaygenecolor
title: MultiWayGeneColor
description: "The multi-way synteny display's gene encoding.color: a CSS color or jexl: callback in value, or a field whose values each take a range color, or whose numbers each take the color of the interval…"
sidebar_label: Display -> MultiWayGeneColor
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

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | A CSS color, or a jexl callback over `feature` returning one; unset, goldenrod.<br>_callback args:_ `feature` |
| <span id="slot-scale">**scale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'MultiWayGeneColorScale', { ...colorScaleT…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'MultiWayGeneColorScale',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;...colorScaleTypeSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;scales: DISCRETE_COLOR_SCALES,&#10;&#160;&#160;&#160;&#160;&#160;&#160;scaleName: 'MultiWayGeneColorScaleType',&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; unset follows field',&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorDomainSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;domain:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it',&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorRangeSlot({&#10;&#160;&#160;&#160;&#160;&#160;&#160;range:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts',&#10;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;...colorUnknownSlot,&#10;&#160;&#160;&#160;&#160;...colorNamesSlot,&#10;&#160;&#160;},&#10;&#160;&#160;colorScaleOptions('encoding.color.scale'),&#10;)</code></pre></dialog></span> | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'MultiWayGeneColorLegend', { ...colorTitle…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'MultiWayGeneColorLegend',&#10;&#160;&#160;{ ...colorTitleSlot },&#10;&#160;&#160;colorLegendOptions,&#10;)</code></pre></dialog></span> | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each take one range color, with a key; cluster paints a gene, or a placement box, by its ortholog group |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | ordinal a range color per value of field; threshold a range color per interval between the cut points in domain; unset follows field |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the values that take the range first, in order; a value left out takes a color no listed value or value met before it paints, the first time the track shows it, and keeps it. Under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain: unset takes the next palette color where the display deals one, a color paints that color, "" adds no color from this setting, so a row keeps the color it already has, a variant cell takes the alt hue and a feature the no-value grey |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
