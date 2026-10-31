# @jbrowse/plugin-variants

JBrowse 2 variant adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### variantDensityAlpha

Each record's alpha factor where records too short to see share pixels at
`bpPerPx`, as the variant display fades a zoomed-out row (`recordDensityAlpha`)
at the power of two `bpPerPx` rounds to: 1 where a record covers its pixels
alone. For a host that draws the cells at its own scale.

```js
// type signature
({ start, end, bpPerPx, }: { start: readonly number[]; end: readonly number[]; bpPerPx: number; }) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

### variantRecordTables

The VCF columns of the records a feature table lists, by its `features.id`, for
a host drawing a VCF as the plain variant display does, which draws every
record, a record calling no genotype included:

- `records`: each one's `ref`, `alt` (its alleles joined by `,`) and `filter`,
  aligned to `ids`.
- `info` and `infoFields`: its INFO, as `variantTables` gives them.
- `samples`: a row per record and sample in header order, `feature` (an index
  into `ids`) and `sample`; `format`, a column per FORMAT key aligned to it,
  typed as INFO is; and `formatFields`, each key's declaration.
- `annotations` and `annotationFields`: its ANN or CSQ consequences, as
  `variantTables` gives them, `feature` an index into `ids`.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, regions, ids, }: {…}) => Promise<{ samples: {…}; format: Record<string, unknown[]>; formatFields: { key: string[]; number: string[]; type: string[]; description: string[]; }; annotations: { [x: string]: number[] | string[] | (string | null)[]; key: string[]; }; annotationFields: { key: string[]; field: string[]; }; info: Record<string, unknown[]>; infoFields: { key: string[]; number: string[]; type: string[]; description: string[]; }; records: { ref: string[]; alt: string[]; filter: (string | null)[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

### variantTables

A region of a multi-sample VCF as the variant display fetches, filters and
paints it, as tables: `variants`, each record the display keeps, with its color
and its `filter`; `info`, each INFO key's values aligned to `variants`, and
`infoFields`, the header's declaration of each key; `annotations`, each record's
SnpEff `ANN` or VEP `CSQ` consequences, a row per record and consequence, which
then leave `info` (`consequenceTables`); `cells`, each sample's (or under
`unit: 'haplotype'` each haplotype's) cell at each record, with its genotype,
its `dosage` and the fill the display paints it; `rows`, the rows the cells
name, top to bottom as the display arranges them by `rows` and stacks them in
`facet`'s bands, each with its label and band; `bands`, each band's value and
label, in stacking order; `legend`, `legendTitle` and `ramps`, the key the
display shows; and `warnings`, the samples file's. With
`genotypes.reference.show` off, the default, a reference call draws no cell.
Several regions share the rows and the key, as the display's regions do: a
record crossing regions is listed in each, under one `key`, every `variants` and
`cells` row names its `region`'s index, and `cells.variant` indexes the joined
`variants`. For a host that draws them itself, such as R through V8. The
adapters must be registered on `pluginManager` (`registerVariantAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, regions, display, byteLimit, }: VariantTablesArgs) => Promise<{ rowLegend: {…}; rowLegendTitle: string; bands: {…}; config: Record<…>; warnings: never[] | string[]; legend: {…}; legendTitle: string; ramps: {…}[]; cells: {…}; rows: {…}; annotations: {…}; annotationFields: {…}; info: Record<…>; infoFields: {…}; variants: { start: number[]; end: number[]; id: string[]; name: string[]; ref: string[]; alt: string[]; type: string[]; color: string[]; filter: (string | null)[]; region: number[]; key: number[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

<!-- API_DOCS_END -->
