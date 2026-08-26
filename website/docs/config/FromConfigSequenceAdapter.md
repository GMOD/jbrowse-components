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
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "FromConfigSequenceAdapter", ... }`. This adapter has no
`uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it
the location slots below. Slot types (`fileLocation`, `frozen`, ...) are
explained in the [config slot types reference](/docs/config_guides/slot_types).
Slots a base configuration contributes are listed here too, so this table is the
whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapterid">**adapterId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | stable identifier used as the adapter cache key; avoids hashing the (potentially large) features array. optional — falls back to hash. |
| <span id="slot-features">**features**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | one entry per reference sequence, each with a `uniqueId`, `refName`, `start`, `end`, and a `seq` string holding the bases for that span. The bases live in the config, so this is for small sequences — a plasmid, a test contig — not a genome. |
