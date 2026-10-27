---
id: marksize
title: MarkSize
description: "A mark's width in px, as color is its color: a point's size, its diameter, or a stroked mark's strokeWidth, a rule's or a line's thickness or a link's stroke."
sidebar_label: Display setting -> MarkSize
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markSizeConfigSchema.ts).

A mark's width in px, as `color` is its color: a point's `size`, its
diameter, or a stroked mark's `strokeWidth`, a rule's or a line's
thickness or a link's stroke. A number is the constant every instance
takes, and is written to `value`; a string is a feature field, and is
written to `field`, which a link's `strokeWidth` reads through `scale`, a
linear or log scale into a px range, so a score becomes a width the way a
ramp makes it a color.

## Example usage

```js
{ mark: 'point', encoding: { y: 'score', size: 7 } }
```

```js
{
  mark: 'link',
  encoding: {
    strokeWidth: { field: 'score', scale: { type: 'log', range: [1, 8] } },
  },
}
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The px every instance takes: a point's diameter, a rule's or a line's thickness, a link's stroke where it reads no `field`. Unset is the mark's own, 4 for a point or a rule, 1 for a line and 2 for a link. Writing `size: 7` lands here. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The feature field a link's stroke width reads, or a jexl expression over `feature`. Empty draws every instance at `value`. Writing `strokeWidth: "score"` lands here. |
| <span id="slot-scale">**scale**</span><br>[MarkSizeScale sub-schema](#slot-scaletype) | How the field's values map to widths, Vega-Lite's scale object. |
| <span id="slot-scaletype">**scale.type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | `linear` or `log` between `domainMin` and `domainMax`. |
| <span id="slot-scaledomainmin">**scale.domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the thinnest width stands at; unset, the loaded regions' own least. |
| <span id="slot-scaledomainmax">**scale.domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The value the widest width stands at; unset, the loaded regions' own greatest. |
| <span id="slot-scalerange">**scale.range**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The px at each end of the domain, thinnest first. Empty is 1 to 6. |
