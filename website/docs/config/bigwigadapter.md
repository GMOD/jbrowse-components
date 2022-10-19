---
id: bigwigadapter
title: BigWigAdapter
toplevel: true
---

#### slot: bigWigLocation
```js

    /**
     * !slot
     */
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    }
```
#### slot: source
```js


    /**
     * !slot
     */
    source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
    }
```
