# @jbrowse/plugin-alignments

JBrowse 2 alignments adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### alignmentTables

A region's reads, or several regions', as the alignments display fetches,
filters, lays out and colors them, as tables: the worker's reads, mismatches,
gaps, insertions, clips, modifications, per-base qualities, coverage and splice
junctions, each read on the row the display's pileup layout gives it and in the
color the display's `color` object paints it, with the key the display shows:
`legend`, and `ramps`, its color bars (`rampKeyOf`). Under a `facet` each
section lays out on its own, every row names its `section`, and `sections` lists
them in stacking order; ungrouped, there is one section, labelled `''`. Several
regions lay out as the display lays out a view's regions, on one set of rows: a
read crossing regions is listed in each, under one `key` and on one `row`, and
every row names its `region`'s index. `warnings` names what the config asked for
that the tables dropped. For a host that draws them itself, such as R through
V8. The adapters must be registered on `pluginManager`
(`registerAlignmentsAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, regions, display, refNames, byteLimit, spanLimit, }: AlignmentTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

### referenceSequence

A region of the reference, as the sequence adapter a track's assembly names
reads it: the bases as one string, for a host drawing them under a pileup.

```js
// type signature
(pluginManager: PluginManager, { sequenceAdapter, region, }: { sequenceAdapter: Record<string, unknown>; region: { refName: string; start: number; end: number; }; }) => Promise<string>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)

<!-- API_DOCS_END -->
