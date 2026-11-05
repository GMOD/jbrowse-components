---
id: ribboncolor
title: RibbonColor
description: "The multi-way synteny display's ribbons.encoding.color: one color for every ribbon, or a field each ribbon carries: the record's strand (the default, while the channel names neither a field nor a…"
sidebar_label: Display setting -> RibbonColor
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts).

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

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The color of every ribbon while no field paints. |
| <span id="slot-scale">**scale**</span><br>[RibbonColorScale sub-schema](#slot-scaletype) | How the field's values map to colors, Vega-Lite's scale object. |
| <span id="slot-legend">**legend**</span><br>[RibbonColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | field to color each ribbon by: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth one-to-one against shared orthologs, as the synteny view's do; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it) |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear, threshold, ordinal) | linear runs a number along a ramp, threshold bins it at the cuts domain lists, and ordinal paints a column's values one color each, numbers included (a measurement keeps its preset); a written type wins over the values, so a text value under linear or threshold paints as missing; unset, a measurement uses its preset scale and a column linear for numbers and ordinal once a value is text |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | a text column's labels that take the palette first, in order, and lead the key, the rest following sorted, strand's values (1, -1) in the order range colors them, or a threshold's cuts; a label left out takes a color no listed label or label met before it paints, the first time the view meets it, and keeps it |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colors a text column's labels or strand's values take, in domain order, continuing into the default palette past its end; with no domain, each label takes one of them by its name; on a ramp (identity, dnds or a numeric column), its stops, evenly spaced, in place of the field's default stops; under threshold, one per interval |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a ramp scale runs along it, a threshold that writes cuts takes one color per interval from end to end, and an ordinal scale that lists a domain one per value; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a ramp's domain; unset follows the loaded values |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a ramp's domain; unset follows the loaded values |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain. Unset: the next palette color where the display deals one, and the levels a preset field names, such as strand's, keep their own colors. A color: that color. "": no color dealt, so a feature paints the no-value grey, a variant cell the alt hue, and a row keeps the color it already has |
| <span id="slot-scaleinvalid">**scale.invalid**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a feature with no value under an ordinal scale's field; unset, the display's no-value color |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
| <span id="slot-legenddescending">**legend.descending**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | threshold key lists the highest interval first; unset follows the field's preset, else the lowest first |
