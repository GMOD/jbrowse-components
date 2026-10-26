---
id: featureutrs
title: FeatureUtrs
description: "The gene glyphs' utrs, the thinner boxes a coding transcript draws past its CDS, which encoding.color paints."
sidebar_label: Display -> FeatureUtrs
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/featureUtrsConfigSchema.ts).

The gene glyphs' `utrs`, the thinner boxes a coding transcript draws past
its CDS, which `encoding.color` paints. Unset, a UTR takes its transcript's
fill, a field's color or a constant, and the contrasting UTR blue where
nothing sets a fill.

## Example usage

```js
{
  type: 'LinearBasicDisplay',
  utrs: { encoding: { color: { value: 'lightblue' } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-encoding">**encoding**</span><br>[FeatureUtrEncoding sub-schema](#slot-encodingcolor) | The channel the UTR boxes paint through. |
| <span id="slot-encodingcolor">**encoding.color**</span><br>[FeatureUtrColor sub-schema](#slot-encodingcolorvalue) | A constant only: a UTR takes a field's color through its transcript's fill. |
| <span id="slot-encodingcolorvalue">**encoding.color.value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | a CSS color, or a `jexl:` callback over `feature` returning one, painting every UTR box over its transcript's fill<br>_callback args:_ `feature` |
