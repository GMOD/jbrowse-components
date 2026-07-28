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

The input file should be bgzipped and tabix-indexed:

```bash
plink --bfile study --r2 --out study
(head -1 study.ld; tail -n +2 study.ld | sort -k1,1 -k2,2n) > study.sorted.ld
bgzip study.sorted.ld
tabix -s 1 -b 2 -e 2 -S 1 study.sorted.ld.gz
```

Expected columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2 Optional columns: DP
(D'), MAF_A, MAF_B

`study.ld` before bgzipping, whitespace-delimited:

```
CHR_A  BP_A     SNP_A       CHR_B  BP_B     SNP_B       R2
1      729679   rs4970383   1      752566   rs3131972   0.0925926
1      729679   rs4970383   1      754182   rs3131969   0.157316
```

Used by the
[variant LD display](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display)
(triangular r² heatmap) and by
[GWAS Manhattan LD coloring](/docs/config_guides/gwas_track#preparing-the-ld-file)
(LocusZoom-style r² to an index SNP). See either guide for generating the .ld
file with `plink --r2`.

### PlinkLDTabixAdapter - Pre-processor / simplified config

Preprocessor to allow minimal config:

```json
{
  "type": "PlinkLDTabixAdapter",
  "uri": "plink.ld.gz"
}
```

## Related links

- **Track:** [LDTrack](../ldtrack)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                    | Type                    | Description                                     |
| --------------------------------------- | ----------------------- | ----------------------------------------------- |
| [ldLocation](#slot-ldlocation)          | `fileLocation`          | Location of the bgzipped PLINK LD file (.ld.gz) |
| [index.indexType](#slot-indexindextype) | `stringEnum` (TBI, CSI) |                                                 |
| [index.location](#slot-indexlocation)   | `fileLocation`          |                                                 |

<details>
<summary>PlinkLDTabixAdapter - Slots</summary>

#### slot: ldLocation

Location of the bgzipped PLINK LD file (.ld.gz)

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/plink.ld.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/plink.ld.gz.tbi', locationType: 'UriLocation' }`

</details>
