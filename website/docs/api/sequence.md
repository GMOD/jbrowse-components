---
id: sequence
title: sequence
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## registerSequenceAdapters

Registers the reference sequence adapters (indexed and bgzipped FASTA,
2bit) on a plugin manager that wants them without the rest of the plugin's
tracks and displays, as a headless host does.

```js
// type signature
(pluginManager: PluginManager) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/adapters.ts)
