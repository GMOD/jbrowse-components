---
id: vcfadapter
title: VcfAdapter
sidebar_label: Adapter -> VcfAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfAdapter',
    uri: 'https://example.com/variants.vcf',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text (non-bgzipped) VCF files. Loads the whole file into
memory, so prefer the VcfTabixAdapter for large files.

### Used in

Supplies data to the [VariantTrack](../varianttrack) track, rendered by:

- [LinearPairedArcDisplay](../linearpairedarcdisplay)
- [ChordVariantDisplay](../chordvariantdisplay)
- [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- [LinearVariantDisplay](../linearvariantdisplay)

### VcfAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "VcfAdapter",
  "uri": "yourfile.vcf"
}
```

<details open>
<summary>VcfAdapter - Slots</summary>

#### slot: vcfLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.vcf', locationType: 'UriLocation' }`

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

</details>
