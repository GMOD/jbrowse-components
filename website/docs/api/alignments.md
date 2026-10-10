---
id: alignments
title: alignments
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## alignmentTables

A region's reads as the alignments display fetches and lays them out, as
tables: the worker's reads, mismatches, gaps and coverage, each read placed
on the row the display's pileup layout gives it. For a host that draws them
itself, such as R through V8. The adapters must be registered on
`pluginManager` (`registerAlignmentsAdapters`).

```js
// type signature
(pluginManager: PluginManager, { adapterConfig, sequenceAdapter, region, filterBy, byteLimit, }: AlignmentTablesArgs) => Promise<…>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/tables.ts)
