---
id: gtftabixadapter
title: GtfTabixAdapter
sidebar_label: Adapter -> GtfTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/GtfTabixAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index:

```js
{
  type: 'GtfTabixAdapter',
  uri: 'https://example.com/genes.gtf.gz',
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load bgzip-compressed, tabix-indexed GTF files

### GtfTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.gtf.gz.tbi:

```json
{
  "type": "GtfTabixAdapter",
  "uri": "yourfile.gtf.gz"
}
```

### GtfTabixAdapter - Slots

#### slot: gtfGzLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.gtf.gz',
    locationType: 'UriLocation',
  },
}
```

#### slot: index.indexType

```js
{
  model: types.enumeration('IndexType', ['TBI', 'CSI']),
  type: 'stringEnum',
  defaultValue: 'TBI',
}
```

#### slot: index.location

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.gtf.gz.tbi',
    locationType: 'UriLocation',
  },
}
```

#### slot: dontRedispatch

the GtfTabixAdapter has to "redispatch" if it fetches a region and features it
finds inside that region extend outside the region we requested. you can disable
this for certain feature types to avoid fetching e.g. the entire chromosome

```js
{
  type: 'stringArray',
  defaultValue: ['chromosome', 'region', 'contig'],
}
```

#### slot: aggregateField

```js
{
  type: 'string',
  description:
    'field used to aggregate multiple transcripts into a single parent gene feature',
  defaultValue: 'gene_name',
}
```
