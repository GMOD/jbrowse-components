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

```js
{
  type: 'LinearManhattanDisplay',
  color: {
    field: 'ld',
    scale: 'threshold',
    domain: [0.5],
    range: ['#357ebd', '#d43f3a'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The Manhattan display's `color` setting: one CSS colour or `jexl:` callback
for every point, a field whose values each take a range colour with a key,
a numeric field cut into intervals by a `threshold` scale, or LocusZoom
colouring by r² to the index SNP — which is that threshold scale over
`field: "ld"`, whose cuts and colours a config may move. A string is the
constant; a `field` binds the range; `field: "ld"` reads the
`GWASAdapter`'s `ldAdapter`.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "ManhattanColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | A CSS colour, or a jexl callback over `feature` returning one, for every point under the `none` scale. Writing `color: "red"` lands here.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | the feature field whose values each take a range colour, with a key listing the values met: name, refName, a BED extra column, a GFF attribute; ld is each point's r² to the index SNP, read from the GWASAdapter's ldAdapter |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, threshold) | none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points domain lists; unset follows field, and is threshold over ld and categorical over anything else |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | under a categorical scale, the field's values that take the range first, in order, in the key as on the points, the rest following sorted, each on a colour no listed value paints; under a threshold scale, the cut points in ascending order, range taking one entry more than this, one per interval; r² to the index SNP cuts at 0.2, 0.4, 0.6 and 0.8 into the LocusZoom blue-through-red bins unless these say otherwise |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours a categorical scale hands its domain in order, continuing into the default palette past its end, or a threshold scale hands its intervals, lowest first |
