---
id: maftabixadapter
title: MafTabixAdapter
sidebar_label: Adapter -> MafTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/MafTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MafTabixAdapter.md)

## Overview

### MafTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.bed.gz.tbi:

```json
{
  "type": "MafTabixAdapter",
  "uri": "yourfile.bed.gz",
  "samples": ["sample1", "sample2"]
}
```

<details open>
<summary>MafTabixAdapter - Slots</summary>

#### slot: samples

string[] or {id:string,label:string,color?:string}[]

**Type:** `frozen`

```js
{
  type: 'frozen',
  description: 'string[] or {id:string,label:string,color?:string}[]',
  defaultValue: [],
}
```

#### slot: bedGzLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bed.gz',
    locationType: 'UriLocation',
  },
}
```

#### slot: refAssemblyName

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
}
```

#### slot: index.location

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bed.gz.tbi',
  },
}
```

#### slot: index.indexType

**Type:** `stringEnum` · **Default:** `'TBI'`

```js
{
  model: types.enumeration('IndexType', ['TBI', 'CSI']),
  type: 'stringEnum',
  defaultValue: 'TBI',
}
```

#### slot: nhLocation

newick tree

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  description: 'newick tree',
  defaultValue: {
    uri: '/path/to/my.nh',
    locationType: 'UriLocation',
  },
}
```

</details>
