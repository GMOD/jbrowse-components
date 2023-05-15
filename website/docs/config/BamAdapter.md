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
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
    }
```

#### slot: sequenceAdapter

generally refers to the reference genome assembly's sequence adapter currently
needs to be manually added

```js
sequenceAdapter: {
      type: 'frozen',
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      defaultValue: null,
    }
```
