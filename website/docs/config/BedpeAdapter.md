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

### BedpeAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedpeAdapter",
  "uri": "yourfile.bedpe.gz"
}
```

| Slot                                 | Type           | Description                                                               |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------- |
| [bedpeLocation](#slot-bedpelocation) | `fileLocation` | can be plaintext or gzipped, not indexed so loaded into memory on startup |
| [columnNames](#slot-columnnames)     | `stringArray`  | List of column names                                                      |

<details>
<summary>BedpeAdapter - Slots</summary>

#### slot: bedpeLocation

can be plaintext or gzipped, not indexed so loaded into memory on startup

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bedpe.gz', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

</details>

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [LinearPairedArcDisplay](../linearpairedarcdisplay)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:**
  [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:**
  [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)
