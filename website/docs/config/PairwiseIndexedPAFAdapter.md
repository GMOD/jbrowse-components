---
id: pairwiseindexedpafadapter
title: PairwiseIndexedPAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/configSchema.ts)

### PairwiseIndexedPAFAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
    }
```

#### slot: targetAssembly

```js
targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```

#### slot: pifGzLocation

```js
pifGzLocation: {
      type: 'fileLocation',
      description: 'location of pairwise tabix indexed PAF (pif)',
      defaultValue: {
        uri: '/path/to/data/file.pif.gz',
        locationType: 'UriLocation',
      },
    }
```

#### slot: index

```js
index: ConfigurationSchema('TabixIndex', {
  indexType: {
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
    defaultValue: 'TBI',
  },

  location: {
    type: 'fileLocation',
    defaultValue: {
      uri: '/path/to/my.paf.gz.tbi',
      locationType: 'UriLocation',
    },
  },
})
```

#### slot: index.indexType

```js
indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: index.location

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.paf.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```
