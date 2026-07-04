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

_See the **Slots** section below for all available configuration fields._

## Overview

### Used in

Supplies data to the [ReferenceSequenceTrack](../referencesequencetrack) track,
rendered by:

- [LinearGCContentDisplay](../lineargccontentdisplay)
- [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

### BgzipFastaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.fa.fai and
yourfile.fa.gzi:

```json
{
  "type": "BgzipFastaAdapter",
  "uri": "yourfile.fa"
}
```

<details open>
<summary>BgzipFastaAdapter - Slots</summary>

#### slot: fastaLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' }`

#### slot: faiLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/seq.fa.gz.fai', locationType: 'UriLocation' }`

#### slot: metadataLocation

Optional metadata file

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/fa.metadata.yaml', locationType: 'UriLocation' }`

#### slot: gziLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/seq.fa.gz.gzi', locationType: 'UriLocation' }`

</details>
