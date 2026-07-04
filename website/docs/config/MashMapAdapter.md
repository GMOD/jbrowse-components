---
id: mashmapadapter
title: MashMapAdapter
sidebar_label: Adapter -> MashMapAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MashMapAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg19', 'hg38'],
  adapter: {
    type: 'MashMapAdapter',
    uri: 'https://example.com/aln.out',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load MashMap `.out` alignment files (query and target assembly required)

### Used in

Supplies data to the [SyntenyTrack](../syntenytrack) track, rendered by:

- [DotplotDisplay](../dotplotdisplay)
- [LGVSyntenyDisplay](../lgvsyntenydisplay)
- [LinearSyntenyDisplay](../linearsyntenydisplay)

### MashMapAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "MashMapAdapter",
  "uri": "file.out",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

<details open>
<summary>MashMapAdapter - Slots</summary>

#### slot: assemblyNames

Array of assembly names to use for this file. The query assembly name is the
first value in the array, target assembly name is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

Alternative to assemblyNames array: the target assembly

**Type:** `string` · **Default:** `''`

#### slot: queryAssembly

Alternative to assemblyNames array: the query assembly

**Type:** `string` · **Default:** `''`

#### slot: outLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/mashmap.out', locationType: 'UriLocation' }`

</details>
