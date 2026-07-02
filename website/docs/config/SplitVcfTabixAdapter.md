---
id: splitvcftabixadapter
title: SplitVcfTabixAdapter
sidebar_label: Adapter -> SplitVcfTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/SplitVcfTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SplitVcfTabixAdapter.md)

## Overview

<details open>
<summary>SplitVcfTabixAdapter - Slots</summary>

#### slot: vcfGzLocationMap

object like `{chr1:{uri:'url to file'}}`

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: {},
}
```

#### slot: indexLocationMap

object like `{chr1:{uri:'url to index'}}`

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: {},
}
```

#### slot: indexType

**Type:** `stringEnum` · **Default:** `'TBI'`

```js
{
  model: types.enumeration('IndexType', ['TBI', 'CSI']),
  type: 'stringEnum',
  defaultValue: 'TBI',
}
```

#### slot: samplesTsvLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/samples.tsv',
    description:
      'tsv with header like "name\tpopulation\tetc" where the first column is required, and corresponds to the sample names in the VCF files',
    locationType: 'UriLocation',
  },
}
```

</details>
