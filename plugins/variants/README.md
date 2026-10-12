# @jbrowse/plugin-variants

JBrowse 2 variant adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### variantTables

A region of a multi-sample VCF as the multi-sample variant display fetches,
filters and paints it, as tables: `variants`, each record the display keeps,
with its lane color; `cells`, each sample's (or under `unit: 'haplotype'` each
haplotype's) cell at each record, with its genotype, its alt dosage and the fill
the display paints it, `shade(hue, dosage)`; `rows`, the rows the cells name;
and `legend`, the key the display shows. Under `referenceDrawingMode: 'skip'`,
the default, a reference call draws no cell. For a host that draws them itself,
such as R through V8. The adapters must be registered on `pluginManager`
(`registerVariantAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, region, display, byteLimit, }: VariantTablesArgs) => Promise<{ variants: { start: number[]; end: number[]; id: string[]; name: string[]; ref: string[]; alt: string[]; type: string[]; color: string[]; }; cells: { variant: number[]; row: string[]; genotype: string[]; dosage: number[]; color: string[]; }; rows: { name: string[]; sample: string[]; haplotype: number[]; ploidy: number[]; color: string[]; }; legend: { label: string[]; color: string[]; section: string[]; }; rowLegend: { label: string[]; color: string[]; }; rowLegendTitle: string; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/tables.ts)

<!-- API_DOCS_END -->
