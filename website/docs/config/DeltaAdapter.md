---
id: deltaadapter
title: DeltaAdapter
sidebar_label: Adapter -> DeltaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/DeltaAdapter.md)

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

This adapter supplies data to the [SyntenyTrack](../syntenytrack) track type.

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

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description:
    'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
}
```

#### slot: targetAssembly

alternative to assembly names

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames: the target assembly name',
}
```

#### slot: queryAssembly

alternative to assembly names

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames: the query assembly name',
}
```

#### slot: deltaLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/file.delta',
    locationType: 'UriLocation',
  },
}
```

</details>
