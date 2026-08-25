---
id: starfusionadapter
title: StarFusionAdapter
sidebar_label: Adapter -> StarFusionAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/StarFusionAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'StarFusionAdapter',
    uri: 'https://example.com/star-fusion.fusion_predictions.tsv',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load STAR-Fusion `star-fusion.fusion_predictions.tsv` output

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
`"adapter": { "type": "StarFusionAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri` in place of writing a location slot out. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-starfusionlocation">**starFusionLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/star-fusion.fusion_predictions.tsv', locationT…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: '/path/to/star-fusion.fusion_predictions.tsv',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> | STAR-Fusion TSV output file (plain text or gzipped) |
