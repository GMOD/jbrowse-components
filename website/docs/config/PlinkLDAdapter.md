---
id: plinkldadapter
title: PlinkLDAdapter
sidebar_label: Adapter -> PlinkLDAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/PlinkLDAdapter/configSchema.ts).

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

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/plink.ld', locationType: 'UriLocation' }`

</details>
