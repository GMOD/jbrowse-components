---
id: indexedfastaadapter
title: IndexedFastaAdapter
toplevel: true
---

### IndexedFastaAdapter - Slots

#### slot: fastaLocation

```js
fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    }
```

#### slot: faiLocation

```js
faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
    }
```

#### slot: metadataLocation

```js
metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    }
```
