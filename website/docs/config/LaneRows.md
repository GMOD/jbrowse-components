---
id: lanerows
title: LaneRows
description: "The multi-way synteny display's rows: one lane per assembly below the anchor, so a lane is always an assembly and the object takes no field."
sidebar_label: Display setting -> LaneRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneRowsConfigSchema.ts).

The multi-way synteny display's `rows`: one lane per assembly below the
anchor, so a lane is always an assembly and the object takes no `field`. It
is the arrangement a reader gives the lanes, by assembly name, and writing
it changes only the members stated. `sort`
lists the lanes that stack first, in order, the rest following densest-first
so a ribbon chain through adjacent lanes is cut as late as possible; `kept`
names the lanes drawn, empty drawing the track's lanes or every lane.
Haplotype lanes read off a graph follow by structure instead, below any
lanes `sort` pins, so lanes whose deletions and insertions against the
anchor match sit together, in an order worked out once per window. Lanes
take no tree.

## Example usage

```js
{
  type: 'MultiWaySyntenyDisplay',
  rows: { sort: ['GCF_000346465.2', 'poplar'], kept: ['GCF_000346465.2', 'poplar', 'citrus'] },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The lanes that stack first, by assembly name, in this order; the rest follow densest-first. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn for a lane in place of its assembly name, by assembly name. Where the lane labels draw is `labels.lanes`. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The lanes drawn, by assembly name: it selects rather than narrows, replacing the track's lanes and able to add a lane the track does not configure. Empty draws the track's lanes, or every lane where it configures none. |
