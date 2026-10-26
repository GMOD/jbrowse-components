---
id: multiwayribbons
title: MultiWayRibbons
description: "The multi-way synteny display's ribbons: the bands joining each gene's placements in adjacent lanes."
sidebar_label: Display setting -> MultiWayRibbons
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonsConfigSchema.ts).

The multi-way synteny display's `ribbons`: the bands joining each gene's
placements in adjacent lanes.

## Example usage

```js
{ type: 'MultiWaySyntenyDisplay', ribbons: { encoding: { color: 'identity' } } }
```

Curved sides, the linear synteny view's `mark` spelled the same:

```js
{ type: 'MultiWaySyntenyDisplay', ribbons: { mark: { interpolate: 'bump' } } }
```

Denser ribbons, and only the pairs at 98% identity or more, as the linear
synteny view's `encoding.opacity` and `filter` write them:

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbons: {
    encoding: { opacity: 0.6 },
    filter: [{ field: 'identity', gte: 0.98 }],
  },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-encoding">**encoding**</span><br>[MultiWayRibbonsEncoding sub-schema](#slot-encodingcolor) | The channels each ribbon paints through. |
| <span id="slot-encodingcolor">**encoding.color**</span><br>[RibbonColor](../ribboncolor) | `{ value }` paints every ribbon; `"strand"` the record's strand, `"identity"` a preset ramp and `"group"` a declared column. |
| <span id="slot-encodingopacity">**encoding.opacity**</span><br>[SyntenyOpacity](../syntenyopacity) | A [](/docs/config/syntenyopacity) object: `0.6` draws every ribbon at that opacity, a field fades each by its value; unset, 0.3. |
| <span id="slot-mark">**mark**</span><br>[SyntenyMark](../syntenymark) | How each ribbon draws: `interpolate` picks straight or S-curved sides. |
| <span id="slot-filter">**filter**</span><br><code>fieldPredicateList()</code> | The ribbons drawn, a list of [](/docs/config/fieldpredicate) entries a ribbon must all pass. A field is any field `color` takes, or `length`, the record's bp. "Hide unlabelled rows" writes `{ field, valid: true }` for the field the ribbons paint by. |
