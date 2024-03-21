---
id: bedadapter
title: BedAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/bed/src/BedAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedAdapter/configSchema.ts)

### BedAdapter - Slots

#### slot: autoSql

```js
autoSql: {
      defaultValue: '',
      description: 'The autoSql definition for the data fields in the file',
      type: 'string',
    }
```

#### slot: bedLocation

```js
bedLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bed.gz' },
      type: 'fileLocation',
    }
```

#### slot: colEnd

```js
colEnd: {
      defaultValue: 2,
      description: 'The column to use as a "end" attribute',
      type: 'number',
    }
```

#### slot: colRef

```js
colRef: {
      defaultValue: 0,
      description: 'The column to use as a "refName" attribute',
      type: 'number',
    }
```

#### slot: colStart

```js
colStart: {
      defaultValue: 1,
      description: 'The column to use as a "start" attribute',
      type: 'number',
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

#### slot: scoreColumn

```js
scoreColumn: {
      defaultValue: '',
      description: 'The column to use as a "score" attribute',
      type: 'string',
    }
```
