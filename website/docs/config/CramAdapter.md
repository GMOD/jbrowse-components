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

#### slot: craiLocation

```js
craiLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.cram.crai',
      },
      type: 'fileLocation',
    }
```

#### slot: cramLocation

```js
cramLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.cram',
      },
      type: 'fileLocation',
    }
```

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      defaultValue: 3_000_000,
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      type: 'number',
    }
```

#### slot: sequenceAdapter

generally refers to the reference genome assembly's sequence adapter currently
needs to be manually added

```js
sequenceAdapter: {
      defaultValue: null,
      description: 'sequence data adapter',
      type: 'frozen',
    }
```
