---
id: pileupmark
title: PileupMark
description: "The pileup's mark, the bar each read draws as: its height."
sidebar_label: Display -> PileupMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupMarkConfigSchema.ts).

The pileup's `mark`, the bar each read draws as: its `height`.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', pileup: { mark: { height: 3 } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>7</code> | The one compactness setting: the spacing between reads follows from it, and the Normal, Compact and Super-compact presets (7, 3, 1) and the fit-mode squeeze all write or read it. |
