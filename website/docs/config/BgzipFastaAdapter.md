---
id: bgzipfastaadapter
title: BgzipFastaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/sequence/src/BgzipFastaAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/BgzipFastaAdapter/configSchema.ts)

### BgzipFastaAdapter - Slots

#### slot: faiLocation

```js
faiLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/seq.fa.gz.fai',
      },
      type: 'fileLocation',
    }
```

#### slot: fastaLocation

```js
fastaLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/seq.fa.gz' },
      type: 'fileLocation',
    }
```

#### slot: gziLocation

```js
gziLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/seq.fa.gz.gzi',
      },
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
