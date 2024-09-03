---
id: basetrack
title: BaseTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/core/pluggableElementTypes/models/baseTrackConfig.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/baseTrackConfig.ts)

### BaseTrack - Identifier

#### slot: explicitIdentifier

### BaseTrack - Slots

#### slot: name

```js
name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      }
```

#### slot: assemblyNames

```js
assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      }
```

#### slot: description

```js
description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      }
```

#### slot: category

```js
category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      }
```

#### slot: metadata

```js
metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```

#### slot: adapter

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: textSearching.indexedAttributes

```js
indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID'],
        }
```

#### slot: textSearching.indexingFeatureTypesToExclude

```js
indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        }
```

#### slot: textSearching.textSearchAdapter

```js
textSearchAdapter: pluginManager.pluggableConfigSchemaType(
  'text search adapter',
)
```

#### slot: displays

```js
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: formatDetails.feature

```js
feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: formatDetails.subfeatures

```js
subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: formatDetails.depth

```js
depth: {
          type: 'number',
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
        }
```

#### slot: formatDetails.maxDepth

```js
maxDepth: {
          type: 'number',
          defaultValue: 99999,
          description: 'Maximum depth to render subfeatures',
        }
```

#### slot: formatAbout.config

```js
config: {
          type: 'frozen',
          description: 'formats configuration object in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        }
```

#### slot: formatAbout.hideUris

```js
hideUris: {
          type: 'boolean',
          defaultValue: false,
        }
```
