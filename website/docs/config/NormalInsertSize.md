---
id: normalinsertsize
title: NormalInsertSize
description: "The alignments display's normalInsertSize setting: the insert sizes a proper pair counts as normal, which every reader of insertSizeAndOrientation classifies by, the read fills, the connections and…"
sidebar_label: Display setting -> NormalInsertSize
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/normalInsertSizeConfigSchema.ts).

The alignments display's `normalInsertSize` setting: the insert sizes a
proper pair counts as `normal`, which every reader of
`insertSizeAndOrientation` classifies by, the read fills, the connections
and the hover. Both ends pin the band together; unset, each region's band
is sampled from its own pairs. The key names the band in bp wherever every
region in view classifies by one, and the hover names the bound a pair
crosses. Recoloring a level is `encoding.color`'s.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  normalInsertSize: { min: 150, max: 600 },
  encoding: {
    color: {
      field: 'insertSizeAndOrientation',
      scale: { domain: ['long', 'RL'], range: ['#d62728', '#17becf'] },
    },
  },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-min">**min**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the shortest insert in bp a pair counts as normal; shorter is short |
| <span id="slot-max">**max**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the longest insert in bp a pair counts as normal; longer is long |
