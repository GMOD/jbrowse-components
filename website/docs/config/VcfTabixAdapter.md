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

_See the **Config slots** section below for all available configuration fields._

:::caution Gotcha

TBI cannot index a chromosome longer than 512 Mb, which some plant genomes
exceed. Index those with CSI instead and set both `index.location` and
`index.indexType: 'CSI'`; the `uri` shorthand assumes a sibling `.tbi`.

:::

used to load bgzip-compressed, tabix-indexed VCF files

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

| Slot                                           | Type                    | Description |
| ---------------------------------------------- | ----------------------- | ----------- |
| [vcfGzLocation](#slot-vcfgzlocation)           | `fileLocation`          |             |
| [index.indexType](#slot-indexindextype)        | `stringEnum` (TBI, CSI) |             |
| [index.location](#slot-indexlocation)          | `fileLocation`          |             |
| [samplesTsvLocation](#slot-samplestsvlocation) | `fileLocation`          |             |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                   | Type     | Description                                                                                                                                                                           |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [fetchSizeLimit](#slot-fetchsizelimit) | `number` | Matches the feature-track default (5 Mb): the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a tighter gate trips on routine variant views. |

</details>

<details>
<summary>VcfTabixAdapter - Slots</summary>

#### slot: vcfGzLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.vcf.gz.tbi', locationType: 'UriLocation' }`

#### slot: samplesTsvLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation)

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/samples.tsv',
    locationType: 'UriLocation',
  },
}
```

#### slot: fetchSizeLimit

Matches the feature-track default (5 Mb): the tabix byte estimate is
block-granular (a small region still pulls whole BGZF blocks), so a tighter gate
trips on routine variant views. VCF text downloads fast; the feature-density
gate remains the backstop for genuinely over-dense views.

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`5_000_000` · _advanced_

</details>
