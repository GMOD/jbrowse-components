---
id: mashmapadapter
title: MashMapAdapter
sidebar_label: Adapter -> MashMapAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MashMapAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MashMapAdapter.md)

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

This adapter supplies data to the [SyntenyTrack](../syntenytrack) track type.

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

Alternative to assemblyNames array: the target assembly

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames array: the target assembly',
}
```

#### slot: queryAssembly

Alternative to assemblyNames array: the query assembly

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames array: the query assembly',
}
```

#### slot: outLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/mashmap.out',
    locationType: 'UriLocation',
  },
}
```

</details>
