---
id: bedtabixadapter
title: BedTabixAdapter
toplevel: true
---

#### slot: bedGzLocation
```js

    /**
     * !slot
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bed.gz', locationType: 'UriLocation' },
    }
```
#### slot: index.indexType
```js

      /**
       * !slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```
#### slot: index.location
```js

      /**
       * !slot index.location
       */
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


    /**
     * !slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    }
```
#### slot: scoreColumn
```js


    /**
     * !slot
     */
    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    }
```
#### slot: autoSql
```js


    /**
     * !slot
     */
    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    }
```
