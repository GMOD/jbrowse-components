---
id: gff3tabixadapter
title: Gff3TabixAdapter
toplevel: true
---

#### slot: gffGzLocation
```js

    /**
     * !slot
     */
    gffGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff.gz', locationType: 'UriLocation' },
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
#### slot: index.indexType
```js

      /**
       * !slot index.indexType
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.gff.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```
#### slot: dontRedispatch
```js

    /**
     * !slot
     * the Gff3TabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we requested.
     * you can disable this for certain feature types to avoid fetching e.g. the
     * entire chromosome
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region'],
    }
```
