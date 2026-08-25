---
id: splitvcftabixadapter
title: SplitVcfTabixAdapter
sidebar_label: Adapter -> SplitVcfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/SplitVcfTabixAdapter/configSchema.ts).

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

reads a set of per-chromosome VCF files, keyed by refName, instead of a
single combined VCF (useful for large call sets split by chromosome)

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LDDisplay](../lddisplay)
- **Display:** [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:** [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- **Display:** [LinearPairedArcDisplay](../linearpairedarcdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "SplitVcfTabixAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcfgzlocationmap">**vcfGzLocationMap**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | object like `{chr1:{uri:'url to file'}}` |
| <span id="slot-indexlocationmap">**indexLocationMap**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | object like `{chr1:{uri:'url to index'}}` |
| <span id="slot-indextype">**indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | index flavor for every entry of `indexLocationMap` — one setting covers them all, so the per-chromosome files have to be indexed the same way. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/samples.tsv', locationType: 'UriLocation' }</code> | location of a tab-separated table of per-sample metadata, shared by every file in `vcfGzLocationMap`. It needs a header row, and its first column must be the sample name exactly as the VCFs spell it; every other column (`population`, `superpopulation`, ...) becomes a value the multi-sample variant displays can group, sort and color their sample rows by. |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>5_000_000</code> | The same 5 Mb `VcfTabixAdapter` declares, for the same reason: this adapter implements `getRegionByteSize`, so its reads are byte-gated, and without a limit of its own the gate falls back to the display config's conservative 1 Mb (`resolveByteLimit` prefers the adapter's). That gated a split VCF five times tighter than the single-file VCF beside it, on a block-granular tabix estimate that already over-quotes small regions.<br>_advanced_ |
