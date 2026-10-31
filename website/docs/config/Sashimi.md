---
id: sashimi
title: Sashimi
description: "The alignments display's sashimi setting: the junction arcs, over the coverage band or in a strip below it, and in that strip alone while coverage.show is off."
sidebar_label: Display setting -> Sashimi
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/sashimiConfigSchema.ts).

The alignments display's `sashimi` setting: the junction arcs, over the
coverage band or in a strip below it, and in that strip alone while
`coverage.show` is off. The band counts each splice junction from the reads'
N gaps and each same-reference join of a split read's segments by its class
(`junction.class`: `deletion`, `duplication`, which a circRNA back-splice
is, or `inversion`), once per pair of read-adjacent segments as the read
arcs count support. A split junction always takes its class's read-arc
color. Which junctions draw is the display's `filter`,
by its `junction` fields.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  sashimi: { placement: 'auto', labels: { show: true } },
  filter: [
    { field: 'junction.reads', gte: 5 },
    { field: 'junction.canonical', equal: true },
    { field: 'junction.class', oneOf: ['splice', 'duplication'] },
  ],
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the sashimi arcs |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | height of the strip below coverage that down arcs draw in, in pixels |
| <span id="slot-placement">**placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (up, down, auto) = <code>'up'</code> | where the arcs draw: up over the coverage histogram, down in a strip below it, or auto, which sends a junction down where it would cross another. Without the coverage band every arc draws down |
| <span id="slot-labels">**labels**</span><br>[SashimiLabels](../sashimilabels) | The read count on each arc: `show`. |
