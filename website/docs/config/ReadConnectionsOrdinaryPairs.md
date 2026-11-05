---
id: readconnectionsordinarypairs
title: ReadConnectionsOrdinaryPairs
description: "The read connections' ordinaryPairs layer: the pairs that carry no category, drawn as context beside the ones that do: an LR pair inside the insert-size band, which insertSizeAndOrientation calls…"
sidebar_label: Display setting -> ReadConnectionsOrdinaryPairs
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsOrdinaryPairsConfigSchema.ts).

The read connections' `ordinaryPairs` layer: the pairs that carry no
category, drawn as context beside the ones that do: an LR pair inside the
insert-size band, which `insertSizeAndOrientation` calls `normal` and
`normalInsertSize` pins.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, ordinaryPairs: { show: false } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset, the mark decides: arcs draw ordinary pairs as context and the cloud leaves them out. |
