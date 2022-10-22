---
id: nclistadapter
title: NCListAdapter
toplevel: true
---

### NCListAdapter - Slots

#### slot: rootUrlTemplate

```js
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
refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    }
```
