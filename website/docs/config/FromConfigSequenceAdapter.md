---
id: fromconfigsequenceadapter
title: FromConfigSequenceAdapter
description: "Supplies a reference sequence inline in the config, as features whose seq holds the bases for each region."
sidebar_label: Adapter -> FromConfigSequenceAdapter
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigSequenceAdapter/configSchema.ts).

Supplies a reference sequence inline in the config, as features whose `seq`
holds the bases for each region.

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

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "FromConfigSequenceAdapter", ... }`. `FromConfigSequenceAdapter` has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapterid">**adapterId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | leave unset, so the adapter cache keys on a hash of the config and changed features are a new adapter. Code that builds a large config sets it with `withAdapterId`, which stamps that hash in. A hand-written value replaces the hash, so the same value over different features serves the first ones |
| <span id="slot-features">**features**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | one entry per reference sequence, each with a `uniqueId`, `refName`, `start`, `end`, and a `seq` string holding the bases for that span. The config holds the bases, so this suits small sequences — a plasmid, a test contig — not a genome. |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `featureClass` | ignored |
