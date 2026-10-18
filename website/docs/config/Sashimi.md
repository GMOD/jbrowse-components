---
id: sashimi
title: Sashimi
description: "The alignments display's sashimi setting: the splice-junction arcs, drawn in the coverage band, so they draw only while coverage.show is on. Which junctions draw is the display's filter.junctions."
sidebar_label: Display -> Sashimi
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/sashimiConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  sashimi: { placement: 'auto', showCounts: true },
  filter: { junctions: { minReads: 5, nonCanonical: 'exclude' } },
}
```

The alignments display's `sashimi` setting: the splice-junction arcs, drawn
in the coverage band, so they draw only while `coverage.show` is on. Which
junctions draw is the display's `filter.junctions`.

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the sashimi arcs |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | height of the strip below coverage that down arcs draw in, in pixels |
| <span id="slot-placement">**placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (up, down, auto) = <code>'up'</code> | where the arcs draw: up over the coverage histogram, down in a strip below it, or auto, which sends a junction down where it would cross another |
| <span id="slot-showcounts">**showCounts**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the supporting-read count on each arc |
