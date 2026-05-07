---
id: bedgraphtabixadapter
title: BedGraphTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedGraphTabixAdapter.md)

## Docs

### BedGraphTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.bg.gz.tbi:

```json
{
  "type": "BedGraphTabixAdapter",
  "uri": "yourfile.bg.gz"
}
```

### BedGraphTabixAdapter - Slots

#### slot: bedGraphGzLocation

```js
bedGraphGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedgraph',
        locationType: 'UriLocation',
      },
    }
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
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: columnNames

```js
columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    }
```
