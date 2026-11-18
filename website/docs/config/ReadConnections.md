---
id: readconnections
title: ReadConnections
description: "The alignments display's readConnections setting: the band of connections between mates and split segments, drawn as arcs or as the read cloud, which plots each pair at its insert size."
sidebar_label: Display setting -> ReadConnections
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsConfigSchema.ts).

The alignments display's `readConnections` setting: the band of
connections between mates and split segments, drawn as arcs or as the read
cloud, which plots each pair at its insert size. The connectors drawn over
the pileup's own rows are `pileup.connectors`. Both paint a connection
its insert size and orientation class, in the colors the reads'
`encoding.color` declares for that field, and the display's `filter` picks
the connections both draw, by its `connection` and `breakpoint` fields.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, mark: 'rule' },
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, ordinaryPairs: { show: false } },
  filter: [{ field: 'connection.interchrom', equal: true }],
}
```

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: false },
  pileup: { connectors: { show: false } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the band of arcs or the read cloud; pileup.connectors draws the connectors over the reads |
| <span id="slot-mark">**mark**</span><br>[ReadConnectionsMark](../readconnectionsmark) | The shape each connection draws as: `type` `link`, the arcs, or `rule`, the read cloud. |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>35</code> | height in pixels of the connections' own band, drawn under placement: 'below' or 'above', or under 'overlay' while the coverage band is hidden; with coverage shown, overlay arcs draw in its height |
| <span id="slot-placement">**placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) ('overlay', 'above', 'below') = <code>'below'</code> | where the connections sit against the coverage band: overlay on its histogram, above in a band of their own over it, or below in a band under it. With coverage hidden there is nothing to overlay, and overlay draws them rising in a band of their own |
| <span id="slot-encoding">**encoding**</span><br>[ReadConnectionsEncoding](../readconnectionsencoding) | The width each connection strokes at, `strokeWidth`. |
| <span id="slot-ordinarypairs">**ordinaryPairs**</span><br>[ReadConnectionsOrdinaryPairs](../readconnectionsordinarypairs) | The pairs with no category, drawn as context: `show`. |
