---
id: bedadapter
title: BedAdapter
sidebar_label: Adapter -> BedAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedAdapter/configSchema.ts).

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

### Used in

Supplies data to the [FeatureTrack](../featuretrack) track, rendered by:

- [LinearArcDisplay](../lineararcdisplay)
- [LinearBasicDisplay](../linearbasicdisplay)
- [LinearBasicDisplay](../linearbasicdisplay)
- [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

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

path to bed file, also allows gzipped bed

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** `string` · **Default:** `''`

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** `string` · **Default:** `''`

#### slot: colRef

The column to use as a "refName" attribute

**Type:** `number` · **Default:** `0`

#### slot: colStart

The column to use as a "start" attribute

**Type:** `number` · **Default:** `1`

#### slot: colEnd

The column to use as a "end" attribute

**Type:** `number` · **Default:** `2`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** `boolean` · **Default:** `false`

</details>
