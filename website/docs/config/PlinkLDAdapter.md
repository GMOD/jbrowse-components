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

Used by the
[variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
(triangular r² heatmap) and by
[GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
(LocusZoom-style r² to an index SNP). See either guide for generating the .ld
file with `plink --r2`.

### PlinkLDAdapter - Pre-processor / simplified config

Preprocessor to allow minimal config:

```json
{
  "type": "PlinkLDAdapter",
  "uri": "plink.ld"
}
```

## Related links

- **Track:** [LDTrack](../ldtrack)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                           | Type           | Description                                   |
| ------------------------------ | -------------- | --------------------------------------------- |
| [ldLocation](#slot-ldlocation) | `fileLocation` | Location of the PLINK LD file (.ld or .ld.gz) |

<details>
<summary>PlinkLDAdapter - Slots</summary>

#### slot: ldLocation

Location of the PLINK LD file (.ld or .ld.gz)

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/plink.ld', locationType: 'UriLocation' }`

</details>
