---
id: gwasadapter
title: GWASAdapter
sidebar_label: Adapter -> GWASAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/GWASAdapter/configSchema.ts).

adapter for GWAS results files; a BedTabixAdapter with `scoreColumn` defaulted
to `neg_log_pvalue` so files load with a sensible Manhattan plot score out of
the box

## Related links

- **Base config:** [BedTabixAdapter](../bedtabixadapter)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                   | Type     | Description                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [scoreColumn](#slot-scorecolumn)       | `string` | BED column to read as the Manhattan plot score                                                                                                                                                                                                                                                                                                                                                                       |
| [scoreTransform](#slot-scoretransform) | `string` | transform applied to `scoreColumn` to produce the Manhattan -log10(p) value: `none` (column is already -log10, e.g. Pan-UKBB neglog10_pval_*), `negLog10` (column is a raw p-value), `negLog10FromLn` (column is a natural-log p-value, e.g. Pan-UKBB Hail `ln P`), or a `jexl:...` expression of `score` for anything else (e.g. `jexl:-log10(score)`) — arbitrary but slower than the native modes, so opt-in only |
| [ldAdapter](#slot-ldadapter)           | `frozen` | optional PLINK .ld sub-adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r² used for LocusZoom-style coloring when the Manhattan display's `colorBy` is `ld`; null disables it                                                                                                                                                                                                                       |

<details>
<summary>GWASAdapter - Slots</summary>

#### slot: scoreColumn

BED column to read as the Manhattan plot score

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`DEFAULT_SCORE_COLUMN`

#### slot: scoreTransform

transform applied to `scoreColumn` to produce the Manhattan -log10(p) value:
`none` (column is already -log10, e.g. Pan-UKBB neglog10_pval_*), `negLog10`
(column is a raw p-value), `negLog10FromLn` (column is a natural-log p-value,
e.g. Pan-UKBB Hail `ln P`), or a `jexl:...` expression of `score` for anything
else (e.g. `jexl:-log10(score)`) — arbitrary but slower than the native modes,
so opt-in only

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'none'`

#### slot: ldAdapter

optional PLINK .ld sub-adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying
pairwise r² used for LocusZoom-style coloring when the Manhattan display's
`colorBy` is `ld`; null disables it

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from BedTabixAdapter</summary>

[BedTabixAdapter config →](../bedtabixadapter)

#### slot: bedGzLocation

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }`

#### slot: index.indexType

**Type:** [`stringEnum`](/docs/config_guides/slot_types#stringenum) (one of
`TBI`, `CSI`) · **Default:** `'TBI'`

#### slot: index.location

**Type:** [`fileLocation`](/docs/config_guides/slot_types#filelocation) ·
**Default:** `{ uri: '/path/to/my.bed.gz.tbi', locationType: 'UriLocation' }`

#### slot: columnNames

List of column names

**Type:** `stringArray` · **Default:** `[]`

#### slot: autoSql

The autoSql definition for the data fields in the file

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: disableGeneHeuristic

Disable the heuristic that auto-detects BED12 features as gene/transcript
structures. Useful for files that have BED12-like structure but are not genes
(e.g. tandem duplications)

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
