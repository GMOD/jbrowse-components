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

_See the **Slots** section below for all available configuration fields._

## Overview

used to load STAR-Fusion `star-fusion.fusion_predictions.tsv` output

### Used in

Supplies data to the [VariantTrack](../varianttrack) track, rendered by:

- [LinearPairedArcDisplay](../linearpairedarcdisplay)
- [ChordVariantDisplay](../chordvariantdisplay)
- [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
- [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
- [LinearVariantDisplay](../linearvariantdisplay)

### StarFusionAdapter - Pre-processor / simplified config

Allows minimal config:

```json
{ "type": "StarFusionAdapter", "uri": "star-fusion.tsv" }
```

<details open>
<summary>StarFusionAdapter - Slots</summary>

#### slot: starFusionLocation

STAR-Fusion TSV output file (plain text or gzipped)

**Type:** `fileLocation`

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
