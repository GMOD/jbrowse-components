---
id: syntenycoord
title: SyntenyCoord
description: "The coordinate system of the linear synteny and dotplot views, ggplot2's coordfixed: ratio: 1 holds every position axis at one bp per pixel, the dotplot's x and y and each row of a synteny stack, so…"
sidebar_label: View -> SyntenyCoord
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/syntenyCoordConfigSchema.ts).

The coordinate system of the linear synteny and dotplot views, ggplot2's
`coord_fixed`: `ratio: 1` holds every position axis at one bp per pixel,
the dotplot's x and y and each row of a synteny stack, so a longer genome
draws longer. Unset, each axis zooms on its own.

## Example usage

```js
{ type: 'DotplotView', coord: { ratio: 1 } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-ratio">**ratio**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | 1 gives every position axis the same bp per pixel, and the slot accepts no other number; unset lets each zoom on its own |
