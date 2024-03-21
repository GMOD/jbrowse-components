---
id: bedtabixadapter
title: BedTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/bed/src/BedTabixAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedTabixAdapter/configSchema.ts)

### BedTabixAdapter - Slots

#### slot: autoSql

```js
autoSql: {
      defaultValue: '',
      description: 'The autoSql definition for the data fields in the file',
      type: 'string',
    }
```

#### slot: bedGzLocation

```js
bedGzLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bed.gz' },
      type: 'fileLocation',
    }
```

#### slot: columnNames

```js
columnNames: {
      defaultValue: [],
      description: 'List of column names',
      type: 'stringArray',
    }
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
          uri: '/path/to/my.bed.gz.tbi',
        },
        type: 'fileLocation',
      }
```

#### slot: scoreColumn

```js
scoreColumn: {
      defaultValue: '',
      description: 'The column to use as a "score" attribute',
      type: 'string',
    }
```
