---
id: plinkldtabixadapter
title: PlinkLDTabixAdapter
sidebar_label: Adapter -> PlinkLDTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/PlinkLDAdapter/configSchemaTabix.ts).

## Overview

Adapter for reading pre-computed LD data from PLINK --r2 output (tabix-indexed).

The input file should be bgzipped and tabix-indexed: bgzip plink.ld tabix -s1
-b2 -e2 plink.ld.gz

Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2 Optional columns: DP
(D'), MAF_A, MAF_B

### PlinkLDTabixAdapter - Pre-processor / simplified config

Preprocessor to allow minimal config:

```json
{
  "type": "PlinkLDTabixAdapter",
  "uri": "plink.ld.gz"
}
```

<details open>
<summary>PlinkLDTabixAdapter - Slots</summary>

#### slot: ldLocation

Location of the bgzipped PLINK LD file (.ld.gz)

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/plink.ld.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/plink.ld.gz.tbi', locationType: 'UriLocation' }`

</details>
