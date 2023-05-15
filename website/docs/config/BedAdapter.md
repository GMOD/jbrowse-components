---
id: bedadapter
title: BedAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/bed/src/BedAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedAdapter/configSchema.ts)

### BedAdapter - Slots

#### slot: bedLocation

```js
bedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bed.gz', locationType: 'UriLocation' },
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

#### slot: colRef

```js
colRef: {
      type: 'number',
      description: 'The column to use as a "refName" attribute',
      defaultValue: 0,
    }
```

#### slot: colStart

```js
colStart: {
      type: 'number',
      description: 'The column to use as a "start" attribute',
      defaultValue: 1,
    }
```

#### slot: colEnd

```js
colEnd: {
      type: 'number',
      description: 'The column to use as a "end" attribute',
      defaultValue: 2,
    }
```
