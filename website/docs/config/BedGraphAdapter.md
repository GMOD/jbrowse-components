---
id: bedgraphadapter
title: BedGraphAdapter
sidebar_label: Adapter -> BedGraphAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedGraphAdapter.md)

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedGraphAdapter',
    uri: 'https://example.com/signal.bedGraph',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text bedGraph signal files. Loads the whole file into memory,
so prefer the BedGraphTabixAdapter for large files.

### BedGraphAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedGraphAdapter",
  "uri": "yourfile.bed"
}
```

<details open>
<summary>BedGraphAdapter - Slots</summary>

#### slot: bedGraphLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bedgraph',
    locationType: 'UriLocation',
  },
}
```

#### slot: columnNames

```js
{
  type: 'stringArray',
  description: 'List of column names',
  defaultValue: [],
}
```

</details>
