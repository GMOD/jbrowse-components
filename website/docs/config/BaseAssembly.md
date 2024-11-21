---
id: baseassembly
title: BaseAssembly
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/core/assemblyManager/assemblyConfigSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/assemblyManager/assemblyConfigSchema.ts)

This corresponds to the assemblies section of the config

### BaseAssembly - Identifier

#### slot: name

### BaseAssembly - Slots

#### slot: aliases

aliases are "reference name aliases" e.g. aliases for hg38 might be "GRCh38"

```js
aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      }
```

#### slot: sequence

sequence refers to a reference sequence track that has an adapter containing,
importantly, a sequence adapter such as IndexedFastaAdapter

```js
sequence: pluginManager.getTrackType('ReferenceSequenceTrack')!
        .configSchema
```

#### slot: refNameColors

```js
refNameColors: {
        type: 'stringArray',
        defaultValue: [],
        description:
          'Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.',
      }
```

#### slot: refNameAliases.adapter

refNameAliases help resolve e.g. chr1 and 1 as the same entity the data for
refNameAliases are fetched from an adapter, that is commonly a tsv like
chromAliases.txt from UCSC or similar

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: cytobands.adapter

cytoband data is fetched from an adapter, and can be displayed by a view type as
ideograms

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displayName

```js
displayName: {
        type: 'string',
        defaultValue: '',
        description:
          'A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"',
      }
```
