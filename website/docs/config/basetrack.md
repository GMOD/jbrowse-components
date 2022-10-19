---
id: basetrack
title: BaseTrack
toplevel: true
---

#### slot: name
```js

      /**
       * !slot
       */
      name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      }
```
#### slot: assemblyNames
```js

      /**
       * !slot
       */
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      }
```
#### slot: description
```js

      /**
       * !slot
       */
      description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      }
```
#### slot: category
```js

      /**
       * !slot
       */
      category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      }
```
#### slot: metadata
```js

      /**
       * !slot
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```
#### slot: adapter
```js

      /**
       * !slot
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter')
```
#### slot: textSearching.indexedAttributes
```js

        /**
         * !slot textSearching.indexedAttributes
         */
        indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID'],
        }
```
#### slot: textSearching.indexingFeatureTypesToExclude
```js

        /**
         * !slot textSearching.indexingFeatureTypesToExclude
         */
        indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        }
```
#### slot: textSearching.textSearchAdapter
```js


        /**
         * !slot textSearching.textSearchAdapter
         */
        textSearchAdapter: pluginManager.pluggableConfigSchemaType(
          'text search adapter',
        )
```
#### slot: displays
```js


      /**
       * !slot
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```
#### slot: formatDetails.feature
```js

        /**
         * !slot formatDetails.feature
         */
        feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```
#### slot: formatDetails.subfeatures
```js


        /**
         * !slot formatDetails.subfeatures
         */
        subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```
#### slot: formatDetails.depth
```js


        /**
         * !slot formatDetails.depth
         */
        depth: {
          type: 'number',
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
        }
```
