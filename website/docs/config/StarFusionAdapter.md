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

| Slot                                           | Type           | Description                                         |
| ---------------------------------------------- | -------------- | --------------------------------------------------- |
| [starFusionLocation](#slot-starfusionlocation) | `fileLocation` | STAR-Fusion TSV output file (plain text or gzipped) |

<details>
<summary>StarFusionAdapter - Slots</summary>

#### slot: starFusionLocation

STAR-Fusion TSV output file (plain text or gzipped)

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation)

```js
{
  type: 'fileLocation',
  description: 'STAR-Fusion TSV output file (plain text or gzipped)',
  defaultValue: {
    uri: '/path/to/star-fusion.fusion_predictions.tsv',
    locationType: 'UriLocation',
  },
}
```

</details>
