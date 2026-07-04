---
id: splitvcftabixadapter
title: SplitVcfTabixAdapter
sidebar_label: Adapter -> SplitVcfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/SplitVcfTabixAdapter/configSchema.ts).

## Overview

<details open>
<summary>SplitVcfTabixAdapter - Slots</summary>

#### slot: vcfGzLocationMap

object like `{chr1:{uri:'url to file'}}`

**Type:** `frozen` · **Default:** `{}`

#### slot: indexLocationMap

object like `{chr1:{uri:'url to index'}}`

**Type:** `frozen` · **Default:** `{}`

#### slot: indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

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
