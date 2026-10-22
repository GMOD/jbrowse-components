---
id: sequence
title: "@jbrowse/plugin-sequence"
description: "JBrowse 2 sequence adapters, tracks, etc."
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## registerSequenceAdapters

Registers every adapter an assembly's `sequence` can name (indexed,
bgzipped and plain FASTA, 2bit, chrom.sizes) on a plugin manager that wants
them without the rest of the plugin's tracks and displays, as a headless
host does.

```js
// type signature
(pluginManager: PluginManager) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/adapters.ts)
