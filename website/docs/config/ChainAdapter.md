---
id: chainadapter
title: ChainAdapter
sidebar_label: Adapter -> ChainAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/ChainAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ChainAdapter.md)

## Overview

### ChainAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "ChainAdapter",
  "uri": "yourfile.chain.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

### ChainAdapter - Slots

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

can be specified as alternative to assemblyNames

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames array: the target assembly',
}
```

#### slot: queryAssembly

can be specified as alternative to assemblyNames

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames array: the query assembly',
}
```

#### slot: chainLocation

```js
{
  type: 'fileLocation',
  defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
}
```
