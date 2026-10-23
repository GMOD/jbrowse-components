---
id: chordencoding
title: ChordEncoding
description: "A variant chord display's encoding, the channels its chords paint through."
sidebar_label: Display -> ChordEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/chordEncodingConfigSchema.ts).

A variant chord display's `encoding`, the channels its chords paint
through.

## Example usage

```js
{ type: 'ChordVariantDisplay', encoding: { color: { value: 'teal' } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[ChordColor](../chordcolor) | The line color of each resting chord: `{ value }`, a CSS color or `jexl:` callback, or a field of the record, `svType` say, whose values each take a color with a key on the circle. |
