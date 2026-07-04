---
id: linearbasicdisplay
title: LinearBasicDisplay
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `canvas`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/configSchema.ts).

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` sets the feature height preset (`normal`, `compact`, or
`superCompact`):

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'genes-LinearBasicDisplay',
      height: 200,
      displayMode: 'compact',
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

configuration for the basic linear feature display (genes, BED, GFF, etc.)

Color slots are display-level: set them inside a track's `displays` array.
`color` is the main feature fill; use a plain CSS color, or a `jexl:` expression
to color per-feature. (`connectorColor` and `utrColor` set the intron lines and
UTR fill. The legacy `color1`/`color2`/`color3` names still work and map onto
these.)

```json
{
  "type": "FeatureTrack",
  "trackId": "my_genes",
  "name": "Genes",
  "assemblyNames": ["hg19"],
  "adapter": { "type": "Gff3TabixAdapter", "uri": "genes.gff.gz" },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "color": "blue",
      "utrColor": "lightblue"
    }
  ]
}
```

Color by an attribute with a jexl expression:

```json
{
  "type": "LinearBasicDisplay",
  "color": "jexl:get(feature,'type')=='gene'?'blue':'gray'"
}
```

### LinearBasicDisplay - Compatible adapters

Data adapters that can supply the [FeatureTrack](../featuretrack):

- [BedAdapter](../bedadapter)
- [BedTabixAdapter](../bedtabixadapter)
- [BigBedAdapter](../bigbedadapter)
- [Gff3Adapter](../gff3adapter)
- [Gff3TabixAdapter](../gff3tabixadapter)
- [GtfAdapter](../gtfadapter)
- [GtfTabixAdapter](../gtftabixadapter)

### LinearBasicDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearbasicdisplay).

<details open>
<summary>LinearBasicDisplay - Slots</summary>

#### slot: fetchSizeLimit

Raises the inherited 1 Mb default: feature (GFF/BED) tracks are light text, and
the tabix index byte estimate is a coarse upper bound that over-reports small
dense regions, so a single gene routinely tripped the old 1 Mb gate. A few Mb of
feature text downloads fast; the feature-density gate remains the backstop for
genuinely over-dense views. Kept here on the feature leaf so the heavier
alignment/variant displays keep their own tighter inherited limit.

**Type:** `number` · **Default:** `5_000_000` · _advanced_

</details>
