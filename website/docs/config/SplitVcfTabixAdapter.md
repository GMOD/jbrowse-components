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

These slots go inside the track's `adapter`:
`"adapter": { "type": "SplitVcfTabixAdapter", ... }`. This adapter has no `uri`
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the
location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcfgzlocationmap">**vcfGzLocationMap**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | object like `{chr1:{uri:'url to file'}}` |
| <span id="slot-indexlocationmap">**indexLocationMap**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | object like `{chr1:{uri:'url to index'}}` |
| <span id="slot-indextype">**indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> |  |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/samples.tsv', description: 'tsv with header li…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: '/path/to/samples.tsv',&#10;&#160;&#160;&#160;&#160;description:&#10;&#160;&#160;&#160;&#160;&#160;&#160;'tsv with header like "name\tpopulation\tetc" where the first column is required, and corresponds to the sample names in the VCF files',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> |  |
