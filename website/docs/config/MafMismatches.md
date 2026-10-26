---
id: mafmismatches
title: MafMismatches
description: "The MAF display's alignments.mismatches layer: how each species differs from the reference, as each differing base in its own color with its letter, insertion markers and deletion counts, drawn over…"
sidebar_label: Display setting -> MafMismatches
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafMismatchesConfigSchema.ts).

The MAF display's `alignments.mismatches` layer: how each species differs
from the reference, as each differing base in its own color with its
letter, insertion markers and deletion counts, drawn over whatever
`encoding.color` fills the rows with. Alignments' `pileup.mismatches`.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { mismatches: { show: false } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the differing bases, insertion markers and deletion counts |
