---
id: baseassembly
title: BaseAssembly
toplevel: true
---

#### slot: aliases
```js

      /**
       * !slot
       * aliases are "reference name aliases" e.g. aliases for hg38 might be "GRCh38"
       */
      aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      }
```
#### slot: sequence
```js


      /**
       * !slot
       * sequence refers to a reference sequence track that has an adapter containing,
       * importantly, a sequence adapter such as IndexedFastaAdapter
       */
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')
        .configSchema
```
#### slot: refNameColors
```js


      /**
       * !slot
       */
      refNameColors: {
        type: 'stringArray',
        defaultValue: [],
        description:
          'Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.',
      }
```
#### slot: refNameAliases.adapter
```js

          /**
           * !slot refNameAliases.adapter
           * refNameAliases help resolve e.g. chr1 and 1 as the same entity
           * the data for refNameAliases are fetched from an adapter, that is
           * commonly a tsv like chromAliases.txt from UCSC or similar
           */
          adapter: pluginManager.pluggableConfigSchemaType('adapter')
```
#### slot: cytobands.adapter
```js

          /**
           * !slot cytobands.adapter
           * cytoband data is fetched from an adapter, and can be displayed by a
           * view type as ideograms
           */
          adapter: pluginManager.pluggableConfigSchemaType('adapter')
```
#### slot: displayName
```js


      /**
       * !slot
       */
      displayName: {
        type: 'string',
        defaultValue: '',
        description:
          'A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"',
      }
```
