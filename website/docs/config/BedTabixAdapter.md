---
id: bedtabixadapter
title: BedTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedTabixAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedTabixAdapter.md)

## Docs

### BedTabixAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.bed.gz.tbi:

```json
{
  "type": "BedTabixAdapter",
  "uri": "yourfile.bed.gz"
}
```

### BedTabixAdapter - Slots

#### slot: bedGzLocation

```js
bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
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
          uri: '/path/to/my.bed.gz.tbi',
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

#### slot: scoreColumn

```js
scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    }
```

#### slot: autoSql

```js
autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    }
```
