---
id: bamadapter
title: BamAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/BamAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/BamAdapter/configSchema.ts)

used to configure BAM adapter

### BamAdapter - Slots

#### slot: bamLocation

```js
bamLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bam' },
      type: 'fileLocation',
    }
```

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      defaultValue: 5_000_000,
      description:
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      type: 'number',
    }
```

#### slot: index.indexType

```js
indexType: {
        defaultValue: 'BAI',
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
      }
```

#### slot: index.location

```js
location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.bam.bai',
        },
        type: 'fileLocation',
      }
```

#### slot: sequenceAdapter

generally refers to the reference genome assembly's sequence adapter currently
needs to be manually added

```js
sequenceAdapter: {
      defaultValue: null,
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      type: 'frozen',
    }
```
