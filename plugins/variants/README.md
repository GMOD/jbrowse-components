# @jbrowse/plugin-variants

JBrowse 2 variant adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### variantDensityAlpha

Each record's alpha factor where records too short to see share pixels at
`bpPerPx`, as the multi-sample variant display fades a zoomed-out row
(`recordDensityAlpha`) at the power of two `bpPerPx` rounds to: 1 where a record
covers its pixels alone. For a host that draws the cells at its own scale.

```js
// type signature
({ start, end, bpPerPx, }: { start: readonly number[]; end: readonly number[]; bpPerPx: number; }) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

### variantTables

A region of a multi-sample VCF as the multi-sample variant display fetches,
filters and paints it, as tables: `variants`, each record the display keeps,
with its lane color; `cells`, each sample's (or under `unit: 'haplotype'` each
haplotype's) cell at each record, with its genotype, its `dosage` and the fill
the display paints it; `rows`, the rows the cells name, top to bottom as the
display arranges them by `rows` and stacks them in `facet`'s bands, each with
its label and band; `bands`, each band's value, label and the rows it spans; and
`legend` and `ramps`, the key the display shows. Under
`referenceDrawingMode: 'skip'`, the default, a reference call draws no cell. For
a host that draws them itself, such as R through V8. The adapters must be
registered on `pluginManager` (`registerVariantAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, region, display, byteLimit, }: VariantTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

<!-- API_DOCS_END -->
