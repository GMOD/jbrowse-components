---
id: plinkldadapter
title: PlinkLDAdapter
sidebar_label: Adapter -> PlinkLDAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/PlinkLDAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PlinkLDAdapter.md)

## Overview

Adapter for reading pre-computed LD data from PLINK --r2 output. Loads the
entire file into memory - suitable for small to medium files.

For large files, use PlinkLDTabixAdapter with tabix indexing.

Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2 Optional columns: DP
(D'), MAF_A, MAF_B

### PlinkLDAdapter - Pre-processor / simplified config

Preprocessor to allow minimal config:

```json
{
  "type": "PlinkLDAdapter",
  "uri": "plink.ld"
}
```

<details open>
<summary>PlinkLDAdapter - Slots</summary>

#### slot: ldLocation

Location of the PLINK LD file (.ld or .ld.gz)

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/plink.ld',
    locationType: 'UriLocation',
  },
}
```

</details>
