# @jbrowse/plugin-sequence

JBrowse 2 sequence adapters, tracks, etc.

<!-- API_DOCS_START -->

## API

Auto-generated from `#api` JSDoc tags in this package. Do not edit by hand.

### registerSequenceAdapters

Registers every adapter an assembly's `sequence` can name (indexed,
bgzipped and plain FASTA, 2bit, chrom.sizes) on a plugin manager that wants
them without the rest of the plugin's tracks and displays, as a headless
host does.

```js
// type signature
(pluginManager: PluginManager) => void
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/adapters.ts)

<!-- API_DOCS_END -->
