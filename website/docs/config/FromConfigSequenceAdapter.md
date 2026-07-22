---
id: fromconfigsequenceadapter
title: FromConfigSequenceAdapter
sidebar_label: Adapter -> FromConfigSequenceAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigSequenceAdapter/configSchema.ts).

## Example usage

Used as the adapter of an assembly's `sequence` (a `ReferenceSequenceTrack`):

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_refseq',
  adapter: {
    type: 'FromConfigSequenceAdapter',
    features: [
      { uniqueId: 'ctgA', refName: 'ctgA', start: 0, end: 10, seq: 'ATGCATGCAT' },
    ],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

supplies reference sequence inline in the config; each feature's `seq` holds the
bases for its region

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                         | Type     | Description |
| ---------------------------- | -------- | ----------- |
| [adapterId](#slot-adapterid) | `string` |             |
| [features](#slot-features)   | `frozen` |             |

<details>
<summary>FromConfigSequenceAdapter - Slots</summary>

#### slot: adapterId

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: features

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `[]`

</details>
