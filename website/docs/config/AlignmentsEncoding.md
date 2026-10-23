---
id: alignmentsencoding
title: AlignmentsEncoding
description: "The alignments displays' encoding, the channels the reads paint through."
sidebar_label: Display -> AlignmentsEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/alignmentsEncodingConfigSchema.ts).

The alignments displays' `encoding`, the channels the reads paint through.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', encoding: { color: 'tags.HP' } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[AlignmentsColor](../alignmentscolor) | The read fill: `{ value: "steelblue" }` paints every read, `"strand"` a read dimension's own vocabulary and `"tags.HP"` a SAM tag. |
