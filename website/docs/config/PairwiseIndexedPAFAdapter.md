---
id: pairwiseindexedpafadapter
title: PairwiseIndexedPAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PairwiseIndexedPAFAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PairwiseIndexedPAFAdapter.md)

## Docs

### PairwiseIndexedPAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes file.pif.gz.tbi:

```json
{
  "type": "PairwiseIndexedPAFAdapter",
  "uri": "file.pif.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

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
