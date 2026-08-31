---
id: vcfadapter
title: VcfAdapter
sidebar_label: Adapter -> VcfAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfAdapter/configSchema.ts).

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

`variants.vcf` infers `VcfAdapter` and `VariantTrack` on its own, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/variants.vcf',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

used to load plain-text (non-bgzipped) VCF files. Loads the whole file into
memory, so prefer the VcfTabixAdapter for large files.

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LDDisplay](../lddisplay)
- **Display:** [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:** [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Display:** [LinearPairedArcDisplay](../linearpairedarcdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "VcfAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcflocation">**vcfLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.vcf', locationType: 'UriLocation' }</code> | location of the VCF file. May be gzipped; it is read and parsed in full on first use, so the whole call set has to fit in memory. |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/samples.tsv', locationType: 'UriLocation' }</code> | location of a tab-separated table of per-sample metadata. It needs a header row, and its first column must be the sample name exactly as the VCF spells it; every other column (`population`, `superpopulation`, ...) becomes a value the multi-sample variant displays can group, sort and color their sample rows by. |
