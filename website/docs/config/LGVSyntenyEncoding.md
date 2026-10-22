---
id: lgvsyntenyencoding
title: LGVSyntenyEncoding
description: "The LGVSyntenyDisplay's encoding, the channels its blocks paint through."
sidebar_label: Display -> LGVSyntenyEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/lgvSyntenyEncodingConfigSchema.ts).

The LGVSyntenyDisplay's `encoding`, the channels its blocks paint through.

## Example usage

```js
{ type: 'LGVSyntenyDisplay', encoding: { color: 'mapq' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[LGVSyntenyColor](../lgvsyntenycolor) | The block fill, `strand` while it names neither a field nor a constant. |
