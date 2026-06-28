---
id: gtfadapter
title: GtfAdapter
sidebar_label: Adapter -> GtfAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/GtfAdapter.md)

## Example usage

The `uri` shorthand works for plain or gzipped GTF:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GtfAdapter',
    uri: 'https://example.com/genes.gtf',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text GTF files (optionally gzipped). Loads the whole file
into memory, so prefer the GtfTabixAdapter for large files.

### Used in

This adapter supplies data to the [FeatureTrack](../featuretrack) track type.

### GtfAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "GtfAdapter",
  "uri": "yourfile.gtf"
}
```

<details open>
<summary>GtfAdapter - Slots</summary>

#### slot: gtfLocation

path to gtf file, also allows for gzipped gtf

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  description: 'path to gtf file, also allows for gzipped gtf',
  defaultValue: {
    uri: '/path/to/my.gtf',
    locationType: 'UriLocation',
  },
}
```

#### slot: aggregateField

field used to aggregate multiple transcripts into a single parent gene feature

**Type:** `string` · **Default:** `'gene_name'`

```js
{
  type: 'string',
  description:
    'field used to aggregate multiple transcripts into a single parent gene feature',
  defaultValue: 'gene_name',
}
```

</details>
