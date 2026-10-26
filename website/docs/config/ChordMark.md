---
id: chordmark
title: ChordMark
description: "A chord display's mark: how far each chord or ribbon curves in toward the center. A chord's curve scales with its length, so two ends at one locus draw a point at the rim."
sidebar_label: Display setting -> ChordMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/chords/chordMarkConfigSchema.ts).

A chord display's `mark`: how far each chord or ribbon curves in toward the
center. A chord's curve scales with its length, so two ends at one locus
draw a point at the rim.

## Example usage

```js
{ type: 'ChordVariantDisplay', displayId: 'sv-chords', mark: { depth: 0.5 } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-depth">**depth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.9</code> | how deeply each chord curves toward the center, from 0 to 1: 1 runs a chord between opposite points straight through the center, and 0 bows every chord out toward the rim. A shorter chord curves less, in proportion to its length |
