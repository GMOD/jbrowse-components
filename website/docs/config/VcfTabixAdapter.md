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

TBI cannot index a chromosome longer than 512 Mb, which some plant and animal
genomes exceed. Index those with CSI instead: pass `csi: true` alongside the
`uri` shorthand, or set both `index.location` and `index.indexType: 'CSI'`
explicitly.

:::

used to load bgzip-compressed, tabix-indexed VCF files

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LDDisplay](../lddisplay)
- **Display:**
  [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:**
  [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Display:** [LinearPairedArcDisplay](../linearpairedarcdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "VcfTabixAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `csi` in place of writing a location slot out. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcfgzlocation">**vcfGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed VCF, sorted by position. Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/samples.tsv', locationType: 'UriLocation' }</code> | location of a tab-separated table of per-sample metadata. It needs a header row, and its first column must be the sample name exactly as the VCF spells it; every other column (`population`, `superpopulation`, ...) becomes a value the multi-sample variant displays can group, sort and color their sample rows by. |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | Matches the feature-track default (5 Mb): the tabix byte estimate is block-granular (a small region still pulls whole BGZF blocks), so a tighter gate trips on routine variant views. VCF text downloads fast; the feature-density gate remains the backstop for genuinely over-dense views.<br>_advanced_ |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi` (or `.csi`), which is what the `uri` shorthand assumes. |
