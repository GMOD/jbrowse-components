---
id: bamadapter
title: BamAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

used to configure BAM adapter

### BamAdapter - Slots

#### slot: bamLocation

```js
bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam', locationType: 'UriLocation' },
    }
```

#### slot: index.indexType

```js
indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      }
```

#### slot: index.location

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      }
```

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      type: 'number',
      description:
        'used to determine when to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
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
