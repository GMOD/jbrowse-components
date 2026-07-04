---
id: bedpeadapter
title: BedpeAdapter
sidebar_label: Adapter -> BedpeAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedpeAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedpeAdapter',
    uri: 'https://example.com/sv.bedpe',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

intended for SVs in a single assembly

### Used in

Supplies data to the [VariantTrack](../varianttrack) track, rendered by:

- [LinearPairedArcDisplay](../linearpairedarcdisplay)
- [ChordVariantDisplay](../chordvariantdisplay)
- [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- [LinearVariantDisplay](../linearvariantdisplay)

### BedpeAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedpeAdapter",
  "uri": "yourfile.bedpe.gz"
}
```

<details open>
<summary>BedpeAdapter - Slots</summary>

#### slot: bedpeLocation

can be plaintext or gzipped, not indexed so loaded into memory on startup

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bedpe.gz', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

</details>
