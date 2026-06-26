---
id: pafadapter
title: PAFAdapter
sidebar_label: Adapter -> PAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PAFAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PAFAdapter.md)

## Example usage

A PAF has no index, but it needs the query and target assembly names (query
first):

```js
{
  type: 'SyntenyTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['assembly1', 'assembly2'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/aln.paf',
    queryAssembly: 'hg19',
    targetAssembly: 'hg38',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### PAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "PAFAdapter",
  "uri": "file.paf.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

<details open>
<summary>PAFAdapter - Slots</summary>

#### slot: assemblyNames

```js
{
  type: 'stringArray',
  defaultValue: [],
  description:
    'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
}
```

#### slot: targetAssembly

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames: the target assembly name',
}
```

#### slot: queryAssembly

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames: the query assembly name',
}
```

#### slot: pafLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/file.paf',
    locationType: 'UriLocation',
  },
}
```

</details>
