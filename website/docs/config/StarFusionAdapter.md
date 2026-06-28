---
id: starfusionadapter
title: StarFusionAdapter
sidebar_label: Adapter -> StarFusionAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/StarFusionAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/StarFusionAdapter.md)

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

This adapter supplies data to the [VariantTrack](../varianttrack) track type.

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
