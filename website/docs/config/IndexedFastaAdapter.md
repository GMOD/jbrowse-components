---
id: indexedfastaadapter
title: IndexedFastaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/sequence/src/IndexedFastaAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/IndexedFastaAdapter/configSchema.ts)

### IndexedFastaAdapter - Slots

#### slot: faiLocation

```js
faiLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/seq.fa.fai' },
      type: 'fileLocation',
    }
```

#### slot: fastaLocation

```js
fastaLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/seq.fa' },
      type: 'fileLocation',
    }
```

#### slot: metadataLocation

```js
metadataLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/fa.metadata.yaml',
      },
      description: 'Optional metadata file',
      type: 'fileLocation',
    }
```
