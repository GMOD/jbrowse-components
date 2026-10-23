---
id: hicencoding
title: HicEncoding
description: "The Hi-C display's encoding, the channels its bins paint through."
sidebar_label: Display -> HicEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/hicEncodingConfigSchema.ts).

The Hi-C display's `encoding`, the channels its bins paint through.

## Example usage

```js
{ type: 'LinearHicDisplay', encoding: { color: 'observed/expected' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[HicColor](../hiccolor) | The scale from a bin's value to its color: a `linear`, `symlog` or `log` scale onto a named scheme, over a domain whose unset ends follow the loaded counts. |
