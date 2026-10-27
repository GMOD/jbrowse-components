---
id: wigglesize
title: WiggleSize
description: "A quantitative mark's width in px, as color is its color: a point's size, its diameter, or a line's strokeWidth, its thickness."
sidebar_label: Display setting -> WiggleSize
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleSizeConfigSchema.ts).

A quantitative mark's width in px, as `color` is its color: a point's
`size`, its diameter, or a line's `strokeWidth`, its thickness. A number
is the constant every point or line takes, and is written to `value`.

## Example usage

```js
{ type: 'LinearWiggleDisplay', mark: 'point', encoding: { size: 4 } }
```

```js
{ type: 'LinearWiggleDisplay', mark: 'line', encoding: { strokeWidth: 2 } }
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The px every point or line takes. Unset is the mark's own, 2 for a point and 1 for a line. Writing `size: 4` lands here. |
