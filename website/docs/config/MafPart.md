---
id: mafpart
title: MafPart
description: "One part drawn over the MAF display's rows, alignments.inversions or .frames, which show turns on."
sidebar_label: Display -> MafPart
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafPartConfigSchema.ts).

One part drawn over the MAF display's rows, `alignments.inversions` or
`.frames`, which `show` turns on.

## Example usage

```js
{ type: 'LinearMafDisplay', alignments: { inversions: { show: true } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw this part |
