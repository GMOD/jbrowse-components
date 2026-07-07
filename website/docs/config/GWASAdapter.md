---
id: gwasadapter
title: GWASAdapter
sidebar_label: Adapter -> GWASAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/GWASAdapter/configSchema.ts).

## Overview

adapter for GWAS results files; a BedTabixAdapter with `scoreColumn` defaulted
to `neg_log_pvalue` so files load with a sensible Manhattan plot score out of
the box

<details open>
<summary>GWASAdapter - Slots</summary>

#### slot: scoreColumn

BED column to read as the Manhattan plot score

**Type:** `string` · **Default:** `DEFAULT_SCORE_COLUMN`

#### slot: scoreTransform

transform applied to `scoreColumn` to produce the Manhattan -log10(p) value:
`none` (column is already -log10, e.g. Pan-UKBB neglog10_pval_*), `negLog10`
(column is a raw p-value), or `negLog10FromLn` (column is a natural-log p-value,
e.g. Pan-UKBB Hail `ln P`)

**Type:** `stringEnum` (one of `none`, `negLog10`, `negLog10FromLn`) ·
**Default:** `'none'`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details open>
<summary>Inherited from BedTabixAdapter</summary>

[BedTabixAdapter config →](../bedtabixadapter)

#### slot: bedGzLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** `stringEnum` (one of `TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bed.gz.tbi', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** `string` · **Default:** `''`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** `boolean` · **Default:** `false`

</details>

### GWASAdapter - Derives from

- [BedTabixAdapter](../bedtabixadapter)
