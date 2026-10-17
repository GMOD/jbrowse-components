---
id: readconnections
title: ReadConnections
description: "The alignments display's readConnections setting: the band of connections between mates and split segments, drawn as arcs or as the read cloud, which plots each pair at its insert size."
sidebar_label: Display -> ReadConnections
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: {
    show: true,
    mark: 'cloud',
    color: { field: 'insertSize' },
  },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, showOrdinaryPairs: false },
  filter: { connections: { interchrom: 'only' } },
}
```

The alignments display's `readConnections` setting: the band of
connections between mates and split segments, drawn as arcs or as the read
cloud, which plots each pair at its insert size. The connectors drawn over
the pileup's own rows are `pileup.showConnectors`, and which connections
either draws is the display's `filter.connections`.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the read connections |
| <span id="slot-mark">**mark**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (arc, cloud) = <code>'arc'</code> | The two share one band and differ in shape, y scale and one cut: an arc rises with the span between its ends, and the cloud draws a flat line at \|TLEN\| on a log scale and leaves the pairs of modal insert size out unless `showOrdinaryPairs` keeps them. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>35</code> | height in pixels of the connections' own band, drawn under placement: 'down', or under 'up' while the coverage band is hidden; with coverage shown, up arcs draw in its height |
| <span id="slot-placement">**placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (up, down) = <code>'down'</code> | where the connections draw: up over the coverage band, or down in a band of their own below it |
| <span id="slot-linewidth">**lineWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | width of each arc or line in pixels |
| <span id="slot-color">**color**</span><br>[AlignmentsArcColor](../alignmentsarccolor) | The field the connections are colored by, `""` taking the reads' `color` field where a connection paints it. |
| <span id="slot-showordinarypairs">**showOrdinaryPairs**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | Unset, the mark decides: arcs draw ordinary pairs as context and the cloud leaves them out. |
