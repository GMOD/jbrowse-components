---
id: bgzipfastaadapter
title: BgzipFastaAdapter
toplevel: true
---

#### slot: fastaLocation
```js

    /**
     * !slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' },
    }
```
#### slot: faiLocation
```js

    /**
     * !slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.fai',
        locationType: 'UriLocation',
      },
    }
```
#### slot: metadataLocation
```js

    /**
     * !slot
     */
    metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    }
```
#### slot: gziLocation
```js

    /**
     * !slot
     */
    gziLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    }
```
