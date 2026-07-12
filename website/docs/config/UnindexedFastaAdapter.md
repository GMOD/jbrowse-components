---
id: unindexedfastaadapter
title: UnindexedFastaAdapter
sidebar_label: Adapter -> UnindexedFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/UnindexedFastaAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'UnindexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

loads a plain (non-bgzipped) FASTA without a separate index. Reads the whole
sequence into memory, so prefer the IndexedFastaAdapter for large genomes.

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type           | Description            |
| ------------------------------------------ | -------------- | ---------------------- |
| [rewriteRefNames](#slot-rewriterefnames)   | `string`       |                        |
| [fastaLocation](#slot-fastalocation)       | `fileLocation` |                        |
| [metadataLocation](#slot-metadatalocation) | `fileLocation` | Optional metadata file |

<details>
<summary>UnindexedFastaAdapter - Slots</summary>

#### slot: rewriteRefNames

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  contextVariable: ['refName'],
}
```

#### slot: fastaLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/seq.fa', locationType: 'UriLocation' }`

#### slot: metadataLocation

Optional metadata file

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }`

</details>
