---
id: cramadapter
title: CramAdapter
toplevel: true
---
used to configure CRAM adapter
#### slot: fetchSizeLimit
```js

    /**
     * !slot fetchSizeLimit
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'used to determine when to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
    }
```
#### slot: cramLocation
```js


    /**
     * !slot cramLocation
     */
    cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    }
```
#### slot: craiLocation
```js


    /**
     * !slot craiLocation
     */
    craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    }
```
#### slot: sequenceAdapter
```js


    /**
     * !slot sequenceAdapter
     * generally refers to the reference genome assembly's sequence adapter
     * currently needs to be manually added
     */
    sequenceAdapter: {
      type: 'frozen',
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      defaultValue: null,
    }
```
