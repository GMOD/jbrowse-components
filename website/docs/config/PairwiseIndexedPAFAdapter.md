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
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
      type: 'stringArray',
    }
```

#### slot: index

```js
index: ConfigurationSchema('TabixIndex', {
  indexType: {
    defaultValue: 'TBI',
    model: types.enumeration('IndexType', ['TBI', 'CSI']),
    type: 'stringEnum',
  },

  location: {
    defaultValue: {
      locationType: 'UriLocation',
      uri: '/path/to/my.paf.gz.tbi',
    },
    type: 'fileLocation',
  },
})
```

#### slot: index.indexType

```js
indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      }
```

#### slot: index.location

```js
location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.paf.gz.tbi',
        },
        type: 'fileLocation',
      }
```

#### slot: pifGzLocation

```js
pifGzLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/data/file.pif.gz',
      },
      description: 'location of pairwise tabix indexed PAF (pif)',
      type: 'fileLocation',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
      type: 'string',
    }
```

#### slot: targetAssembly

```js
targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
      type: 'string',
    }
```
