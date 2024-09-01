---
id: cramadapter
title: CramAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/CramAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/CramAdapter/configSchema.ts)

used to configure CRAM adapter

### CramAdapter - Slots

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
    }
```

#### slot: cramLocation

```js
cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    }
```

#### slot: craiLocation

```js
craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    }
```

#### slot: sequenceAdapter

generally refers to the reference genome assembly's sequence adapter currently
needs to be manually added

```js
sequenceAdapter: {
      type: 'frozen',
      description: 'sequence data adapter',
      defaultValue: null,
    }
```
