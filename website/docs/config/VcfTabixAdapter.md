---
id: vcftabixadapter
title: VcfTabixAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

## Docs

### VcfTabixAdapter - Slots

#### slot: vcfGzLocation

```js
vcfGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf.gz', locationType: 'UriLocation' },
    }
```

#### slot: index.indexType

```js
indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      }
```

#### slot: index.location

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```
