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

## Overview

### StarFusionAdapter - Pre-processor / simplified config

Allows minimal config:

```json
{ "type": "StarFusionAdapter", "uri": "star-fusion.tsv" }
```

### StarFusionAdapter - Slots

#### slot: starFusionLocation

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
