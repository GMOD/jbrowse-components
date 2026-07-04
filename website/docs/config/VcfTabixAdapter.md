---
id: vcftabixadapter
title: VcfTabixAdapter
sidebar_label: Adapter -> VcfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfTabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index (pass `csi: true` for a
`.csi` index):

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load bgzip-compressed, tabix-indexed VCF files

### Used in

Supplies data to the [VariantTrack](../varianttrack) track, rendered by:

- [LinearPairedArcDisplay](../linearpairedarcdisplay)
- [ChordVariantDisplay](../chordvariantdisplay)
- [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- [LinearVariantDisplay](../linearvariantdisplay)

### VcfTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.vcf.gz.tbi:

```json
{
  "type": "VcfTabixAdapter",
  "uri": "yourfile.vcf.gz"
}
```

<details open>
<summary>VcfTabixAdapter - Slots</summary>

#### slot: vcfGzLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.vcf.gz.tbi', locationType: 'UriLocation' }`

#### slot: samplesTsvLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/samples.tsv',
    description:
      'tsv with header like name\tpopulation\tetc. where the first column is required, and is the sample names',
    locationType: 'UriLocation',
  },
}
```

#### slot: fetchSizeLimit

size in bytes over which to display a warning to the user that too much data
will be fetched

**Type:** `number` · **Default:** `1_000_000` · _advanced_

</details>
