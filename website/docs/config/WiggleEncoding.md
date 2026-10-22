---
id: wiggleencoding
title: WiggleEncoding
description: "The quantitative display's encoding, the channels its marks paint through."
sidebar_label: Display -> WiggleEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleEncodingConfigSchema.ts).

The quantitative display's `encoding`, the channels its marks paint
through.

## Example usage

```js
{ type: 'LinearWiggleDisplay', encoding: { color: { value: 'darkgreen' } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[WiggleColor](../wigglecolor) | One CSS color in `value`, or the score through a `scale`, with a key. |
