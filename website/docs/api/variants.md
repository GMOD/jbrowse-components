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
`bpPerPx`, as the multi-sample variant display fades a zoomed-out row
(`recordDensityAlpha`) at the power of two `bpPerPx` rounds to: 1 where a
record covers its pixels alone. For a host that draws the cells at its own
scale.

```js
// type signature
({ start, end, bpPerPx, }: { start: readonly number[]; end: readonly number[]; bpPerPx: number; }) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

## variantRecordTables

The VCF columns of the records a feature table lists, by its `features.id`,
for a host drawing a VCF as the plain variant display does, which draws
every record, a record calling no genotype included:
- `records`: each one's `ref`, `alt` (its alleles joined by `,`) and
  `filter`, aligned to `ids`.
- `info` and `infoFields`: its INFO, as `variantTables` gives them.
- `samples`: a row per record and sample in header order, `feature` (an
  index into `ids`) and `sample`; `format`, a column per FORMAT key aligned
  to it, typed as INFO is; and `formatFields`, each key's declaration.
- `annotations` and `annotationFields`: its ANN or CSQ consequences, as
  `variantTables` gives them, `feature` an index into `ids`.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, regions, ids, }: { adapterConfig: Record<…>; sequenceAdapter?: Record<…> | undefined; regions: { refName: string; start: number; end: number; }[]; ids: readonly string[]; }) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

## variantTables

A region of a multi-sample VCF as the multi-sample variant display fetches,
filters and paints it, as tables: `variants`, each record the display
keeps, with its lane color and its `filter`; `info`, each INFO key's
values aligned to `variants`, and `infoFields`, the header's declaration
of each key; `annotations`, each record's SnpEff `ANN` or VEP `CSQ`
consequences, a row per record and consequence, which then leave `info`
(`consequenceTables`); `cells`, each sample's (or under
`unit: 'haplotype'` each haplotype's) cell at each record, with its
genotype, its `dosage` and the fill the display paints it; `rows`, the
rows the cells name, top to bottom as the display arranges them by `rows`
and stacks them in `facet`'s bands, each with its label and band; `bands`,
each band's value, label and the rows it spans; and `legend` and `ramps`,
the key the display shows. Under `referenceDrawingMode: 'skip'`, the default,
a reference call draws no cell. Several regions share the rows and the key,
as the display's regions do: a record crossing regions is listed in each,
under one `key`, every `variants` and `cells` row names its `region`'s
index, and `cells.variant` indexes the joined `variants`. For a host that
draws them itself, such as R through V8. The adapters must be registered on
`pluginManager` (`registerVariantAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, regions, display, byteLimit, }: VariantTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)
