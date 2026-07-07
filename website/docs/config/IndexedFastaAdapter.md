---
id: indexedfastaadapter
title: IndexedFastaAdapter
sidebar_label: Adapter -> IndexedFastaAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/IndexedFastaAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.fai` index:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### IndexedFastaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.fa.fai:

```json
{
  "type": "IndexedFastaAdapter",
  "uri": "yourfile.fa"
}
```

| Slot                                       | Type           | Description            |
| ------------------------------------------ | -------------- | ---------------------- |
| [fastaLocation](#slot-fastalocation)       | `fileLocation` |                        |
| [faiLocation](#slot-failocation)           | `fileLocation` |                        |
| [metadataLocation](#slot-metadatalocation) | `fileLocation` | Optional metadata file |

<details>
<summary>IndexedFastaAdapter - Slots</summary>

#### slot: fastaLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/seq.fa', locationType: 'UriLocation' }`

#### slot: faiLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' }`

#### slot: metadataLocation

Optional metadata file

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }`

</details>

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)
