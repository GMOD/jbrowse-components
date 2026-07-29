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

These slots go inside the track's `adapter`:
`"adapter": { "type": "VcfAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-vcflocation">**vcfLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.vcf', locationType: 'UriLocation' }</code> |  |
| <span id="slot-samplestsvlocation">**samplesTsvLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/samples.tsv', description: 'tsv with header li…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: '/path/to/samples.tsv',&#10;&#160;&#160;&#160;&#160;description:&#10;&#160;&#160;&#160;&#160;&#160;&#160;'tsv with header like name\tpopulation\tetc. where the first column is required, and is the sample names',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> |  |
