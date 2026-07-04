---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
sidebar_label: Adapter -> BedGraphTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts).

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

Supplies data to the [QuantitativeTrack](../quantitativetrack) track, rendered
by:

- [LinearWiggleDisplay](../linearwiggledisplay)

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

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bedgraph', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bedgraph.gz.tbi', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

</details>
