---
id: comparative-adapters
title: "@jbrowse/plugin-comparative-adapters"
description: "JBrowse 2 comparative adapters"
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## contigTables

Each side of a pairwise file as tables: `query` and `target`, each its
assembly name and its contigs in the order the file first names them, with
the length the file states (`null` for a file such as an MCScan anchors
file, which lists genes and no contigs). A host lays
a whole-genome axis out of them, as the dotplot import does from an
assembly.

```js
// type signature
(pluginManager: PluginManager, { adapterConfig }: ContigTablesArgs) => Promise<{ query: { assemblyName: string; refName: string[]; length: (number | null)[]; }; target: { assemblyName: string; refName: string[]; length: (number | null)[]; }; }>
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/tables.ts)
