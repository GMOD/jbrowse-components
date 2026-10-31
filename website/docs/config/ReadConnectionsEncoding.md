---
id: readconnectionsencoding
title: ReadConnectionsEncoding
description: "The read connections' encoding: the width each connection strokes at."
sidebar_label: Display setting -> ReadConnectionsEncoding
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsEncodingConfigSchema.ts).

The read connections' `encoding`: the width each connection strokes at.
A connection's color is its insert size and orientation class, as the
reads' `insertSizeAndOrientation` color names it, declared colors included.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, encoding: { strokeWidth: 2 } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-strokewidth">**strokeWidth**</span><br>[ReadConnectionsStrokeWidth](../readconnectionsstrokewidth) | The width each connection strokes at. |
