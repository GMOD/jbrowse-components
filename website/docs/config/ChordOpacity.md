---
id: chordopacity
title: ChordOpacity
description: "A variant chord display's encoding.opacity: one alpha for every resting chord, over its color's own. A number is written to value."
sidebar_label: Display setting -> ChordOpacity
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/chordOpacityConfigSchema.ts).

A variant chord display's `encoding.opacity`: one alpha for every resting
chord, over its color's own. A number is written to `value`.

## Example usage

```js
{ type: 'ChordVariantDisplay', encoding: { opacity: 0.45 } }
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The alpha every resting chord draws at, 0 to 1, over its color's own; unset is 0.32. |
