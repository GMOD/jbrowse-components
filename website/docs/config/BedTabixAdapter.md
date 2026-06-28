---
id: bedtabixadapter
title: BedTabixAdapter
sidebar_label: Adapter -> BedTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedTabixAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a `.csi`
index instead:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://example.com/features.bed.gz',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### Used in

This adapter supplies data to the [FeatureTrack](../featuretrack) track type.

### BedTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.bed.gz.tbi:

```json
{
  "type": "BedTabixAdapter",
  "uri": "yourfile.bed.gz"
}
```

<details open>
<summary>BedTabixAdapter - Slots</summary>

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
    uri: '/path/to/my.bed.gz.tbi',
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

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  description: 'The column to use as a "score" attribute',
  defaultValue: '',
}
```

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  description: 'The autoSql definition for the data fields in the file',
  defaultValue: '',
}
```

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  description:
    'Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications)',
  defaultValue: false,
}
```

</details>
