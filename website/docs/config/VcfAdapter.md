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

_See the **Config slots** section below for all available configuration fields._

used to load plain-text (non-bgzipped) VCF files. Loads the whole file into
memory, so prefer the VcfTabixAdapter for large files.

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [LinearPairedArcDisplay](../linearpairedarcdisplay)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:**
  [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:**
  [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                           | Type           | Description |
| ---------------------------------------------- | -------------- | ----------- |
| [vcfLocation](#slot-vcflocation)               | `fileLocation` |             |
| [samplesTsvLocation](#slot-samplestsvlocation) | `fileLocation` |             |

<details>
<summary>VcfAdapter - Slots</summary>

#### slot: vcfLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.vcf', locationType: 'UriLocation' }`

#### slot: samplesTsvLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation)

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
