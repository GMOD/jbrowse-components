---
id: indexedfastaadapter
title: IndexedFastaAdapter
toplevel: true
---

#### slot: fastaLocation
```js

    /**
     * !slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    }
```
#### slot: faiLocation
```js

    /**
     * !slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
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
