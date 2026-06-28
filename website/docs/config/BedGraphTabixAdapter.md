---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
sidebar_label: Adapter -> BedGraphTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedGraphTabixAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphTabixAdapter',
    uri: 'https://example.com/signal.bedGraph.gz',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load bgzip-compressed, tabix-indexed bedGraph signal files

### Used in

This adapter supplies data to the [QuantitativeTrack](../quantitativetrack)
track type.

### BedGraphTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.bg.gz.tbi:

```json
{
  "type": "BedGraphTabixAdapter",
  "uri": "yourfile.bg.gz"
}
```

<details open>
<summary>BedGraphTabixAdapter - Slots</summary>

#### slot: bedGraphGzLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bedgraph',
    locationType: 'UriLocation',
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

#### slot: index.location

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bedgraph.gz.tbi',
    locationType: 'UriLocation',
  },
}
```

#### slot: columnNames

List of column names

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  description: 'List of column names',
  defaultValue: [],
}
```

</details>
