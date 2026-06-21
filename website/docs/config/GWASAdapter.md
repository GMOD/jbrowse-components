---
id: gwasadapter
title: GWASAdapter
sidebar_label: Adapter -> GWASAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/GWASAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/GWASAdapter.md)

## Overview

adapter for GWAS results files; a BedTabixAdapter with `scoreColumn` defaulted
to `neg_log_pvalue` so files load with a sensible Manhattan plot score out of
the box

<details open>
<summary>GWASAdapter - Slots</summary>

#### slot: scoreColumn

```js
{
  type: 'string',
  description: 'BED column to read as the Manhattan plot score',
  defaultValue: 'neg_log_pvalue',
}
```

#### slot: scoreTransform

transform applied to `scoreColumn` to produce the Manhattan -log10(p) value:
`none` (column is already -log10, e.g. Pan-UKBB neglog10*pval*\*), `negLog10`
(column is a raw p-value), or `negLog10FromLn` (column is a natural-log p-value,
e.g. Pan-UKBB Hail `ln P`)

```js
{
  type: 'stringEnum',
  model: types.enumeration('GwasScoreTransform', [
    'none',
    'negLog10',
    'negLog10FromLn',
  ]),
  description: 'transform applied to the score column',
  defaultValue: 'none',
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BedTabixAdapter</summary>

[BedTabixAdapter config →](../bedtabixadapter)

#### slot: bedGzLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bed.gz',
    locationType: 'UriLocation',
  },
}
```

#### slot: index.indexType

```js
{
  model: types.enumeration('IndexType', ['TBI', 'CSI']),
  type: 'stringEnum',
  defaultValue: 'TBI',
}
```

#### slot: index.location

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bed.gz.tbi',
    locationType: 'UriLocation',
  },
}
```

#### slot: columnNames

```js
{
  type: 'stringArray',
  description: 'List of column names',
  defaultValue: [],
}
```

#### slot: scoreColumn

```js
{
  type: 'string',
  description: 'The column to use as a "score" attribute',
  defaultValue: '',
}
```

#### slot: autoSql

```js
{
  type: 'string',
  description: 'The autoSql definition for the data fields in the file',
  defaultValue: '',
}
```

#### slot: disableGeneHeuristic

```js
{
  type: 'boolean',
  description:
    'Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications)',
  defaultValue: false,
}
```

</details>

### GWASAdapter - Derives from

- [BedTabixAdapter](../bedtabixadapter)

```js
baseConfiguration: bedTabixConfigSchema
```
