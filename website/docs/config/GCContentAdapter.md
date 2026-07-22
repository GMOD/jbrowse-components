---
id: gccontentadapter
title: GCContentAdapter
sidebar_label: Adapter -> GCContentAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentAdapter/configSchema.ts).

## Related links

- **Track:** [QuantitativeTrack](../quantitativetrack)
- **Display:** [LinearWiggleDisplay](../linearwiggledisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                     | Type                         | Description                                          |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| [sequenceAdapter](#slot-sequenceadapter) | `frozen`                     |                                                      |
| [gcMode](#slot-gcmode)                   | `stringEnum` (content, skew) | calculate GC content fraction or GC skew (G-C)/(G+C) |

<details>
<summary>Advanced slots (2)</summary>

| Slot                             | Type     | Description |
| -------------------------------- | -------- | ----------- |
| [windowSize](#slot-windowsize)   | `number` |             |
| [windowDelta](#slot-windowdelta) | `number` |             |

</details>

<details>
<summary>GCContentAdapter - Slots</summary>

#### slot: sequenceAdapter

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

#### slot: windowSize

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`
· _advanced_

#### slot: windowDelta

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`
· _advanced_

#### slot: gcMode

calculate GC content fraction or GC skew (G-C)/(G+C)

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`content`, `skew`) · **Default:** `'content'`

</details>
