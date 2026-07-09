---
id: splitvcftabixadapter
title: SplitVcfTabixAdapter
sidebar_label: Adapter -> SplitVcfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/SplitVcfTabixAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'SplitVcfTabixAdapter',
    vcfGzLocationMap: {
      chr1: { uri: 'chr1.vcf.gz' },
      chr2: { uri: 'chr2.vcf.gz' },
    },
    indexLocationMap: {
      chr1: { uri: 'chr1.vcf.gz.tbi' },
      chr2: { uri: 'chr2.vcf.gz.tbi' },
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

reads a set of per-chromosome VCF files, keyed by refName, instead of a single
combined VCF (useful for large call sets split by chromosome)

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

| Slot                                           | Type                    | Description                               |
| ---------------------------------------------- | ----------------------- | ----------------------------------------- |
| [vcfGzLocationMap](#slot-vcfgzlocationmap)     | `frozen`                | object like `{chr1:{uri:'url to file'}}`  |
| [indexLocationMap](#slot-indexlocationmap)     | `frozen`                | object like `{chr1:{uri:'url to index'}}` |
| [indexType](#slot-indextype)                   | `stringEnum` (TBI, CSI) |                                           |
| [samplesTsvLocation](#slot-samplestsvlocation) | `fileLocation`          |                                           |

<details>
<summary>SplitVcfTabixAdapter - Slots</summary>

#### slot: vcfGzLocationMap

object like `{chr1:{uri:'url to file'}}`

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: indexLocationMap

object like `{chr1:{uri:'url to index'}}`

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: samplesTsvLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation)

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/samples.tsv',
    description:
      'tsv with header like "name\tpopulation\tetc" where the first column is required, and corresponds to the sample names in the VCF files',
    locationType: 'UriLocation',
  },
}
```

</details>
