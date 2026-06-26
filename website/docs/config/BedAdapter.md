---
id: bedadapter
title: BedAdapter
sidebar_label: Adapter -> BedAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedAdapter.md)

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedAdapter',
    uri: 'https://example.com/features.bed',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text BED files. Loads the whole file into memory, so prefer
the BedTabixAdapter for large files.

### BedAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedAdapter",
  "uri": "yourfile.bed"
}
```

<details open>
<summary>BedAdapter - Slots</summary>

#### slot: bedLocation

```js
{
  type: 'fileLocation',
  description: 'path to bed file, also allows gzipped bed',
  defaultValue: {
    uri: '/path/to/my.bed.gz',
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

#### slot: scoreColumn

```js
{
  type: 'string',
  description: 'The column to use as a "score" attribute',
  defaultValue: '',
}
```

#### slot: autoSql

```js
{
  type: 'string',
  description: 'The autoSql definition for the data fields in the file',
  defaultValue: '',
}
```

#### slot: colRef

```js
{
  type: 'number',
  description: 'The column to use as a "refName" attribute',
  defaultValue: 0,
}
```

#### slot: colStart

```js
{
  type: 'number',
  description: 'The column to use as a "start" attribute',
  defaultValue: 1,
}
```

#### slot: colEnd

```js
{
  type: 'number',
  description: 'The column to use as a "end" attribute',
  defaultValue: 2,
}
```

#### slot: disableGeneHeuristic

```js
{
  type: 'boolean',
  description:
    'Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications)',
  defaultValue: false,
}
```

</details>
