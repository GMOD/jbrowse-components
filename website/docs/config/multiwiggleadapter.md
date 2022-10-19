---
id: multiwiggleadapter
title: MultiWiggleAdapter
toplevel: true
---

#### slot: subadapters
```js

    /**
     * !slot
     */
    subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    }
```
#### slot: bigWigs
```js

    /**
     * !slot
     */
    bigWigs: {
      type: 'frozen',
      description:
        'array of bigwig filenames, alternative to the subadapters slot',
      defaultValue: [],
    }
```
