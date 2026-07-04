---
id: deltaadapter
title: DeltaAdapter
sidebar_label: Adapter -> DeltaAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'DeltaAdapter',
    uri: 'https://example.com/aln.delta',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load MUMmer `.delta` alignment files (query and target assembly
required)

### Used in

Supplies data to the [SyntenyTrack](../syntenytrack) track, rendered by:

- [DotplotDisplay](../dotplotdisplay)
- [LGVSyntenyDisplay](../lgvsyntenydisplay)
- [LinearSyntenyDisplay](../linearsyntenydisplay)

### DeltaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "DeltaAdapter",
  "uri": "yourfile.delta.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

<details open>
<summary>DeltaAdapter - Slots</summary>

#### slot: assemblyNames

Array of assembly names to use for this file. The query assembly name is the
first value in the array, target assembly name is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

alternative to assembly names

**Type:** `string` · **Default:** `''`

#### slot: queryAssembly

alternative to assembly names

**Type:** `string` · **Default:** `''`

#### slot: deltaLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/file.delta', locationType: 'UriLocation' }`

</details>
