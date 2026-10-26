---
id: readconnections
title: ReadConnections
description: "The alignments display's readConnections setting: the band of connections between mates and split segments, drawn as arcs or as the read cloud, which plots each pair at its insert size."
sidebar_label: Display setting -> ReadConnections
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsConfigSchema.ts).

The alignments display's `readConnections` setting: the band of
connections between mates and split segments, drawn as arcs or as the read
cloud, which plots each pair at its insert size. The connectors drawn over
the pileup's own rows are `pileup.connectors`. Both read one
`encoding.color`, set here, and the display's `filter` picks the
connections both draw, by its `connection` and `breakpoint` fields.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: {
    show: true,
    mark: 'rule',
    encoding: { color: 'insertSize' },
  },
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
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>35</code> | height in pixels of the connections' own band, drawn under placement: 'down', or under 'up' while the coverage band is hidden; with coverage shown, up arcs draw in its height |
| <span id="slot-placement">**placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (up, down) = <code>'down'</code> | where the connections draw: up over the coverage band, or down in a separate band below it |
| <span id="slot-encoding">**encoding**</span><br>[ReadConnectionsEncoding](../readconnectionsencoding) | The color and width each connection strokes at: `color`, a pair field, `""` following the reads' `encoding.color` field where a connection paints it, and `strokeWidth`. |
| <span id="slot-ordinarypairs">**ordinaryPairs**</span><br>[ReadConnectionsOrdinaryPairs](../readconnectionsordinarypairs) | The pairs that carry no category, drawn as context: `show`. |
