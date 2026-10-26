---
id: ribboncolor
title: RibbonColor
description: "The multi-way synteny display's ribbons.encoding.color: one color for every ribbon, or a field each ribbon carries: the record's strand (the default, while the channel names neither a field nor a…"
sidebar_label: Display setting -> RibbonColor
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
  ribbons: { encoding: { color: { value: 'grey' } } },
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

## Preset fields

A `field` named here paints through its own scale while `scale.type` is unset, and `range` and `names` index its levels in order while `domain` is unwritten.

<!-- prettier-ignore -->
| Field | Scale | Levels | Names | Other defaults |
| --- | --- | --- | --- | --- |
| `mapq` | threshold | `1`, `10`, `30` | MAPQ 0 (multi-mapping), MAPQ 1-9 (low), MAPQ 10-29, MAPQ 30+ (high confidence) | `scheme: cividis`; key "Mapping quality" |
| `identity` | linear |  |  | `domainMin: 0`; `domainMax: 1`; `scheme: redgreyblue`; key "Identity" |
| `dnds` | linear |  |  | `domainMin: 0`; `domainMax: 2`; `domainMid: 1`; `scheme: redyellowblue`; `reverse: true`; key "dN/dS" |
| `syntenicDepth` | threshold | `2`, `3` | One-to-one, Shared by 2 genes, Shared by 3 or more | `range`: `#bdbdbd`, `#fdae6b`, `#e6550d`; key "Syntenic depth" |

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The color of every ribbon while no field paints. |
| <span id="slot-scale">**scale**</span><br>RibbonColorScale sub-schema | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>RibbonColorLegend sub-schema | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | field to color each ribbon by: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth one-to-one against shared orthologs, as the synteny view's do; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it) |
