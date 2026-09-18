---
id: manhattancolor
title: ManhattanColor
sidebar_label: Display -> ManhattanColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/LinearManhattanDisplay/colorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearManhattanDisplay', color: 'goldenrod' }
```

```js
{
  type: 'LinearManhattanDisplay',
  color: { field: 'population', domain: ['EUR', 'AFR'] },
}
```

```js
{ type: 'LinearManhattanDisplay', color: { field: 'ld' } }
```

_See the **Config slots** section below for all available configuration fields._

The Manhattan display's `color` setting: one CSS colour or `jexl:` callback
for every point, a field whose values each take a palette colour with a key,
or LocusZoom colouring by r² to the index SNP. A string is the constant; a
`field` binds the palette; `field: "ld"` reads the `GWASAdapter`'s
`ldAdapter`.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "ManhattanColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | A CSS colour, or a jexl callback over `feature` returning one, for every point under the `none` scale. Writing `color: "red"` lands here.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the feature field whose values each take a palette colour, with a key listing the values met: name, refName, a BED extra column, a GFF attribute; ld is each point's r² to the index SNP, read from the GWASAdapter's ldAdapter |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical) | none paints value and keeps the field for a switch back; categorical a palette colour per value of field; unset follows field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the field's values that take the palette first, in order, in the key as on the points; the rest follow sorted, each on a colour no listed value paints |
| <span id="slot-palette">**palette**</span><br>`stringArray` = <code>[]</code> | CSS colors the domain values take, in order, continuing into the default palette past its end |
