---
id: bedtabixadapter
title: BedTabixAdapter
sidebar_label: Adapter -> BedTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedTabixAdapter/configSchema.ts).

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

Supplies data to the [FeatureTrack](../featuretrack) track, rendered by:

- [LinearArcDisplay](../lineararcdisplay)
- [LinearBasicDisplay](../linearbasicdisplay)
- [LinearBasicDisplay](../linearbasicdisplay)
- [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

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

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bed.gz.tbi', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

#### slot: scoreColumn

The column to use as a "score" attribute

**Type:** `string` · **Default:** `''`

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** `string` · **Default:** `''`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** `boolean` · **Default:** `false`

</details>
