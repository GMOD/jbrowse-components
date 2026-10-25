---
id: yencoding
title: YEncoding
description: "A display's encoding holding the y channel alone, whose marks each name the field their encoding.y reads through it."
sidebar_label: Display -> YEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/yEncodingConfigSchema.ts).

A display's `encoding` holding the y channel alone, whose marks each name
the field their `encoding.y` reads through it.

## Example usage

```js
{
  type: 'LinearMarkDisplay',
  encoding: { y: { scale: { type: 'log' }, axis: { title: 'depth' } } },
}
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-y">**y**</span><br><code>y</code> | The value axis every mark's `encoding.y` is read through: `scale`, `axis` and `rules`. |
