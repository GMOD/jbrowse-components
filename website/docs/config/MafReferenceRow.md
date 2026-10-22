---
id: mafreferencerow
title: MafReferenceRow
description: "The MAF display's alignments.reference part: the reference species' own row, which every other row is scored against."
sidebar_label: Display -> MafReferenceRow
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafReferenceRowConfigSchema.ts).

The MAF display's `alignments.reference` part: the reference species' own
row, which every other row is scored against. Under mismatch coloring it
draws one constant color, and under codon coloring it carries the reference
amino acids. The FASTA export keeps it either way.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { reference: { show: false } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | give the reference species a row of its own |
