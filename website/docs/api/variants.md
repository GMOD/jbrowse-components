---
id: variants
title: "@jbrowse/plugin-variants"
description: "JBrowse 2 variant adapters, tracks, etc."
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## variantDensityAlpha

Each record's alpha factor where records too short to see share pixels at
`bpPerPx`, as the variant display fades a zoomed-out row
(`recordDensityAlpha`) at the power of two `bpPerPx` rounds to: 1 where a
record covers its pixels alone. For a host that draws the cells at its own
scale.

```js
// type signature
({ start, end, bpPerPx, }: { start: readonly number[]; end: readonly number[]; bpPerPx: number; }) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

## variantGenotypeMatrix

The matrix the variant display's "Cluster rows by genotype" clusters, over
the records and rows `variantTables` gives for the same args
(`genotypeMatrixOf`): `rows`, named and ordered as its `rows`; `columns`,
each record in `variants.key` order, its key as `variant`, and its `name`,
that key 1-based. With a row per sample, a record takes a column per ALT,
`allele` its 1-based index and named `<key>.<allele>` where it has several,
scored 0 to 2 as twice that allele's share of the called alleles
(`readAltDosages`); with a row per haplotype, one column, `allele` 0, 1
where the haplotype carries any ALT. `values` holds them row-major, NaN for
a no-call, an unphased call's haplotype, and a sample the record's file
does not list.

```js
// type signature
(pluginManager: PluginManager, variantArgs: VariantTablesArgs) => Promise<{ rows: string[]; columns: { name: string[]; variant: number[]; allele: number[]; }; values: Float32Array<ArrayBuffer>; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

## variantRecordTables

The VCF columns of the records a feature table lists, by its `features.id`,
for a host drawing a VCF as the plain variant display does, which draws
every record, a record calling no genotype included:
- `records`: each one's `ref`, `alt` (its alleles joined by `,`) and
  `filter`, aligned to `ids`.
- `info` and `infoFields`: its INFO, as `variantTables` gives them.
- `samples`: a row per record and each sample its own file lists, in that
  file's header order (a split VCF's per-contig files may differ), `feature` (an
  index into `ids`) and `sample`; `format`, a column per FORMAT key aligned
  to it, typed as INFO is; and `formatFields`, each key's declaration.
- `annotations` and `annotationFields`: its ANN or CSQ consequences, as
  `variantTables` gives them, `feature` an index into `ids`.

A record `ids` lists more than once, as a feature table lists one crossing
regions in each, has its `samples` and `annotations` rows once, `feature`
its first index.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, regions, ids, }: {…}) => Promise<{ samples: {…}; format: Record<string, unknown[]>; formatFields: { key: string[]; number: string[]; type: string[]; description: string[]; }; annotations: { [x: string]: number[] | string[] | (string | null)[]; key: string[]; }; annotationFields: { key: string[]; field: string[]; }; info: Record<string, unknown[]>; infoFields: { key: string[]; number: string[]; type: string[]; description: string[]; }; records: { ref: string[]; alt: string[]; filter: (string | null)[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

## variantTables

A region of a multi-sample VCF as the variant display fetches,
filters and paints it, as tables: `variants`, each record the display
keeps, with its `color` as the records band paints it (its SV class's,
else `featureDefaultColor`, under no picked `encoding.color` and under
`phaseSet`; else the alt cells' hue at full dose) and its `filter`;
`info`, each INFO key's
values aligned to `variants`, and `infoFields`, the header's declaration
of each key; `annotations`, each record's SnpEff `ANN` or VEP `CSQ`
consequences, a row per record and consequence, which then leave `info`
(`consequenceTables`); `cells`, each sample's (or under
`rows.field: 'haplotype'` each haplotype's) cell at each record, with its
genotype, its `dosage` and the fill the display paints it; `rows`, the
rows the cells name, top to bottom as the display arranges them by `rows`
and stacks them in `facet`'s bands, each with its label and band; `bands`,
each band's value and label, in stacking order; `legend`, `legendTitle`
and `ramps`, the key the display shows; `rowBackground`, the fill the
display paints behind its rows; `height`, the px the rows' slot takes
(`height` as written, else the display's default), the records band above
it apart; `rowHeight`, the px each row draws at, `rows.step` or the slot
divided between the rows, as the display resolves it; and `warnings`, the
samples file's. With `genotypes.reference.show` off, the default, a
reference call draws no cell, and `rowBackground` is the reference call's
color, standing in for every one; on, `rowBackground` is `''`. With
`genotypes.show` off, and unset on a one-sample VCF, no row draws, so
`rows` and `cells` are empty, the key is the records', and no genotype is
read, so `minorAlleleFrequency` and `missingness` filter nothing, as on a
sites-only VCF. The records sit at their genomic positions whatever
`variantLayout` says. Several regions share the rows and the key, as the
display's regions do: a record crossing regions is listed in each, under
one `key`, with its `annotations` once, under its first listing; every
`variants` and `cells` row names its `region`'s index, and `cells.variant`
indexes the joined `variants`. For a host that draws them itself, such as
R through V8. The adapters must be registered on `pluginManager`
(`registerVariantAdapters`).

```js
// type signature
(pluginManager: PluginManager, variantArgs: VariantTablesArgs) => Promise<{ rowLegend: {…}; rowLegendTitle: string; bands: {…}; rowBackground: string; height: number; rowHeight: number; config: Record<…>; warnings: never[] | string[]; legend: {…}; legendTitle: string; ramps: {…}[]; cells: {…}; rows: {…}; annotations: {…}; annotationFields: {…}; info: Record<…>; infoFields: {…}; variants: { start: number[]; end: number[]; id: string[]; name: string[]; ref: string[]; alt: string[]; type: string[]; color: string[]; filter: (string | null)[]; region: number[]; key: number[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)
