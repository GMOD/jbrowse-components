---
id: nclistadapter
title: NCListAdapter
toplevel: true
---

#### slot: rootUrlTemplate
```js

    /**
     * !slot
     */
    rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    }
```
#### slot: refNames
```js

    /**
     * !slot
     */
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    }
```
