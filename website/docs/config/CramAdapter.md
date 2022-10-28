---
id: cramadapter
title: CramAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

## Docs

used to configure CRAM adapter

### CramAdapter - Slots

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      type: 'number',
      description:
        'used to determine when to display a warning to the user that too much data will be fetched',
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

generally refers to the reference genome assembly's sequence adapter
currently needs to be manually added

```js
sequenceAdapter: {
      type: 'frozen',
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      defaultValue: null,
    }
```
