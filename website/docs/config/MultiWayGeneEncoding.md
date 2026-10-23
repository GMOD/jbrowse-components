---
id: multiwaygeneencoding
title: MultiWayGeneEncoding
description: "The multi-way synteny display's encoding, the channels its gene glyphs paint through."
sidebar_label: Display -> MultiWayGeneEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/geneEncodingConfigSchema.ts).

The multi-way synteny display's `encoding`, the channels its gene glyphs
paint through.

## Example usage

```js
{ type: 'MultiWaySyntenyDisplay', encoding: { color: 'cluster' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[MultiWayGeneColor](../multiwaygenecolor) | The gene glyphs' fill: `{ value }`, a CSS color or `jexl:` callback, goldenrod unset, or a field and the `scale` its values map through, with a key. |
