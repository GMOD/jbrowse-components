---
id: indexedfastaadapter
title: IndexedFastaAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

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
