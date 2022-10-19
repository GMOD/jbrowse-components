---
id: vcftabixadapter
title: VcfTabixAdapter
toplevel: true
---

#### slot: vcfGzLocation
```js

    /**
     * !slot
     */
    vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' },
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
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```
