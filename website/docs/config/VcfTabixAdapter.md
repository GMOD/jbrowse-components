---
id: vcftabixadapter
title: VcfTabixAdapter
sidebar_label: Adapter -> VcfTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/VcfTabixAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index (pass `csi: true` for a
`.csi` index):

```js
{
  type: 'VcfTabixAdapter',
  uri: 'https://example.com/variants.vcf.gz',
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load bgzip-compressed, tabix-indexed VCF files

### VcfTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes tbi index at yourfile.vcf.gz.tbi:

```json
{
  "type": "VcfTabixAdapter",
  "uri": "yourfile.vcf.gz"
}
```

### VcfTabixAdapter - Slots

#### slot: vcfGzLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.vcf.gz',
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
    uri: '/path/to/my.vcf.gz.tbi',
    locationType: 'UriLocation',
  },
}
```

#### slot: samplesTsvLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/samples.tsv',
    description:
      'tsv with header like name\tpopulation\tetc. where the first column is required, and is the sample names',
    locationType: 'UriLocation',
  },
}
```
