---
id: ribboncolor
title: RibbonColor
description: "The multi-way synteny display's ribbons.encoding.color: one color for every ribbon, or a field each ribbon carries: the record's strand (the default, while the channel names neither a field nor a…"
sidebar_label: Display -> RibbonColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts).

The multi-way synteny display's `ribbons.encoding.color`: one color for
every ribbon, or a field each ribbon carries: the record's strand (the
default, while the channel names neither a field nor a color), a
measurement through its preset (`identity`, `mapq`, `dnds`,
`syntenicDepth`), or a column the table declares in `attributeColumns`,
through the same slots as the synteny view's
[SyntenyColor](../syntenycolor). A string is the field.

## Example usage

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbons: { encoding: { color: { value: 'rgba(130,130,130,0.3)' } } },
}
```

```js
{ type: 'MultiWaySyntenyDisplay', ribbons: { encoding: { color: 'strand' } } }
```

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbons: {
    encoding: {
      color: {
        field: 'strand',
        scale: {
          range: ['#1b9e77', '#d95f02'],
          names: ['Kept', 'Inverted'],
        },
      },
    },
  },
}
```

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbons: {
    encoding: {
      color: {
        field: 'group',
        scale: { domain: ['core', 'shell'], invalid: 'lightgrey' },
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
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The color of every ribbon while no field paints. |
| <span id="slot-scale">**scale**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'RibbonColorScale', { ...syntenyColorScale…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'RibbonColorScale',&#10;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;...syntenyColorScaleSlots('RibbonColorScaleType'),&#10;&#160;&#160;&#160;&#160;invalid: {&#10;&#160;&#160;&#160;&#160;&#160;&#160;type: 'maybeColor',&#10;&#160;&#160;&#160;&#160;&#160;&#160;description:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'the color of a pair with no value for the field, whose alpha every ribbon takes; unset, rgba(130,130,130,0.3)',&#10;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;},&#10;&#160;&#160;colorScaleOptions('ribbons.encoding.color.scale'),&#10;)</code></pre></dialog></span> | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-invalid">**invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The color of a pair with no value for the field, Vega-Lite's word for a missing value's output; its alpha is every ribbon's under the field. |
| <span id="slot-legend">**legend**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ConfigurationSchema( 'RibbonColorLegend', syntenyColorLegendSlo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ConfigurationSchema(&#10;&#160;&#160;'RibbonColorLegend',&#10;&#160;&#160;syntenyColorLegendSlots,&#10;&#160;&#160;colorLegendOptions,&#10;)</code></pre></dialog></span> | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | field to color each ribbon by: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth one-to-one against shared orthologs, as the synteny view's do; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it) |
