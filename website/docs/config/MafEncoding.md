---
id: mafencoding
title: MafEncoding
description: "The MAF display's encoding, the channels its aligned cells paint through and the field its rows' bars show."
sidebar_label: Display setting -> MafEncoding
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafEncodingConfigSchema.ts).

The MAF display's `encoding`, the channels its aligned cells paint through
and the field its rows' bars show.

## Example usage

```js
{ type: 'LinearMafDisplay', encoding: { color: 'identity', y: 'identity' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[MafColor](../mafcolor) | What fills each aligned cell: the field `identity` or `refNameRank`, or a constant `value`, and the scale the field's values map through. Base and codon colors belong to the per-base layer, `alignments.bases.encoding.color`. |
| <span id="slot-y">**y**</span><br>[MafY](../mafy) | The value a row's bar height shows: `identity`, or unset for none. |
