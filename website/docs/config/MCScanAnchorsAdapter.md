---
id: mcscananchorsadapter
title: MCScanAnchorsAdapter
sidebar_label: Adapter -> MCScanAnchorsAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MCScanAnchorsAdapter',
    uri: 'https://example.com/data.anchors',
    bed1: 'https://example.com/query.bed',
    bed2: 'https://example.com/target.bed',
    assemblyNames: ['hg19', 'hg38'],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load MCScan (jcvi) `.anchors` files with their two BED files

### Used in

Supplies data to the [SyntenyTrack](../syntenytrack) track, rendered by:

- [DotplotDisplay](../dotplotdisplay)
- [LGVSyntenyDisplay](../lgvsyntenydisplay)
- [LinearSyntenyDisplay](../linearsyntenydisplay)

### MCScanAnchorsAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "MCScanAnchorsAdapter",
  "uri": "file.anchors",
  "bed1": "bed1.bed",
  "bed2": "bed2.bed",
  "assemblyNames": ["hg19", "hg38"]
}
```

<details open>
<summary>MCScanAnchorsAdapter - Slots</summary>

#### slot: mcscanAnchorsLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/mcscan.anchors', locationType: 'UriLocation' }`

#### slot: bed1Location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/file.bed', locationType: 'UriLocation' }`

#### slot: bed2Location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/file.bed', locationType: 'UriLocation' }`

#### slot: assemblyNames

**Type:** `stringArray` · **Default:** `[]`

</details>
