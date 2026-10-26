---
id: readconnectionsmark
title: ReadConnectionsMark
description: "The read connections' mark, Vega-Lite's mark object."
sidebar_label: Display setting -> ReadConnectionsMark
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/readConnectionsMarkConfigSchema.ts).

The read connections' `mark`, Vega-Lite's mark object. A `link` joins the
two ends of each pair or split read with a dome that rises with the span
between them; a `rule` is the read cloud, a flat line between the ends at
the pair's insert size on a log axis, which leaves the pairs of modal
insert size out unless `ordinaryPairs.show` keeps them. A bare name is the
`type`, so `mark: "rule"` and `mark: { type: "rule" }` are one config.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  readConnections: { show: true, mark: 'rule' },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-type">**type**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (link, rule) = <code>'link'</code> | link, a dome between each pair's ends, or rule, the read cloud's flat line at each pair's insert size |
