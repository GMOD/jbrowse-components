---
id: starfusionadapter
title: StarFusionAdapter
description: "Reads the gene fusions that STAR-Fusion predicts, from its star-fusion.fusionpredictions.tsv output."
sidebar_label: Adapter -> StarFusionAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `bed` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/StarFusionAdapter/configSchema.ts).

Reads the gene fusions that STAR-Fusion predicts, from its
`star-fusion.fusion_predictions.tsv` output.

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

JBrowse infers `StarFusionAdapter` and `VariantTrack` from `star-fusion.fusion_predictions.tsv`, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/star-fusion.fusion_predictions.tsv',
  assemblyNames: ['hg38'],
}
```

## Related links

- **Track:** [VariantTrack](../varianttrack)
- **Display:** [ChordVariantDisplay](../chordvariantdisplay)
- **Display:** [LinearMarkDisplay](../linearmarkdisplay)
- **Display:** [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- **Display:** [LinearVariantDisplay](../linearvariantdisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "StarFusionAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-starfusionlocation">**starFusionLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ uri: '/path/to/star-fusion.fusion_predictions.tsv', locationT…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{&#10;&#160;&#160;&#160;&#160;uri: '/path/to/star-fusion.fusion_predictions.tsv',&#10;&#160;&#160;&#160;&#160;locationType: 'UriLocation',&#10;&#160;&#160;}</code></pre></dialog></span> | STAR-Fusion TSV output file (plain text or gzipped) |
