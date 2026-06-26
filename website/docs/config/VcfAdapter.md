---
id: vcfadapter
title: VcfAdapter
sidebar_label: Adapter -> VcfAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/VcfAdapter.md)

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfAdapter',
    uri: 'https://example.com/variants.vcf',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text (non-bgzipped) VCF files. Loads the whole file into
memory, so prefer the VcfTabixAdapter for large files.

### VcfAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "VcfAdapter",
  "uri": "yourfile.vcf"
}
```

<details open>
<summary>VcfAdapter - Slots</summary>

#### slot: vcfLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.vcf',
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

</details>
