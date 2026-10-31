---
id: pileupconnectors
title: PileupConnectors
description: "The pileup's connectors layer: lines over the pileup rows joining each read to its mate or split segment, colored by insert size and orientation, as the reads' color of that name paints them."
sidebar_label: Display setting -> PileupConnectors
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/pileupConnectorsConfigSchema.ts).

The pileup's `connectors` layer: lines over the pileup rows joining each
read to its mate or split segment, colored by
insert size and orientation, as the reads' color of that name paints them.
The band of arcs or the read cloud is
`readConnections`.

## Example usage

```js
{ type: 'LinearAlignmentsDisplay', pileup: { connectors: { show: true } } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw a connector over the pileup from each read to its mate or split segment: straight for a normal pair within one displayed region, curved otherwise. Under unit: 'chain' a connector between displayed regions curves either way |
