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

#### slot: adapter

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: assemblyNames

```js
assemblyNames: {
        defaultValue: ['assemblyName'],
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
      }
```

#### slot: category

```js
category: {
        defaultValue: [],
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
      }
```

#### slot: description

```js
description: {
        defaultValue: '',
        description: 'a description of the track',
        type: 'string',
      }
```

#### slot: displays

```js
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: formatAbout.config

```js
config: {
          contextVariable: ['config'],
          defaultValue: {},
          description: 'formats configuration object in about dialog',
          type: 'frozen',
        }
```

#### slot: formatAbout.hideUris

```js
hideUris: {
          defaultValue: false,
          type: 'boolean',
        }
```

#### slot: formatDetails.depth

```js
depth: {
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
          type: 'number',
        }
```

#### slot: formatDetails.feature

```js
feature: {
          contextVariable: ['feature'],
          defaultValue: {},
          description: 'adds extra fields to the feature details',
          type: 'frozen',
        }
```

#### slot: formatDetails.maxDepth

```js
maxDepth: {
          defaultValue: 99999,
          description: 'Maximum depth to render subfeatures',
          type: 'number',
        }
```

#### slot: formatDetails.subfeatures

```js
subfeatures: {
          contextVariable: ['feature'],
          defaultValue: {},
          description: 'adds extra fields to the subfeatures of a feature',
          type: 'frozen',
        }
```

#### slot: metadata

```js
metadata: {
        defaultValue: {},
        description: 'anything to add about this track',
        type: 'frozen',
      }
```

#### slot: name

```js
name: {
        defaultValue: 'Track',
        description: 'descriptive name of the track',
        type: 'string',
      }
```

#### slot: textSearching.indexedAttributes

```js
indexingAttributes: {
          defaultValue: ['Name', 'ID'],
          description:
            'list of which feature attributes to index for text searching',
          type: 'stringArray',
        }
```

#### slot: textSearching.indexingFeatureTypesToExclude

```js
indexingFeatureTypesToExclude: {
          defaultValue: ['CDS', 'exon'],
          description: 'list of feature types to exclude in text search index',
          type: 'stringArray',
        }
```

#### slot: textSearching.textSearchAdapter

```js
textSearchAdapter: pluginManager.pluggableConfigSchemaType(
  'text search adapter',
)
```
