---
id: bgzipfastaadapter
title: BgzipFastaAdapter
sidebar_label: Adapter -> BgzipFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/BgzipFastaAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.fai` and `.gzi` indexes:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'BgzipFastaAdapter',
    uri: 'https://example.com/genome.fa.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                       | Type           | Description            |
| ------------------------------------------ | -------------- | ---------------------- |
| [fastaLocation](#slot-fastalocation)       | `fileLocation` |                        |
| [faiLocation](#slot-failocation)           | `fileLocation` |                        |
| [metadataLocation](#slot-metadatalocation) | `fileLocation` | Optional metadata file |
| [gziLocation](#slot-gzilocation)           | `fileLocation` |                        |

<details>
<summary>BgzipFastaAdapter - Slots</summary>

#### slot: fastaLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' }`

#### slot: faiLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/seq.fa.gz.fai', locationType: 'UriLocation' }`

#### slot: metadataLocation

Optional metadata file

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }`

#### slot: gziLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/seq.fa.gz.gzi', locationType: 'UriLocation' }`

</details>
