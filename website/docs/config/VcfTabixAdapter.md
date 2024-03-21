---
id: vcftabixadapter
title: VcfTabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/variants/src/VcfTabixAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VcfTabixAdapter/configSchema.ts)

### VcfTabixAdapter - Slots

#### slot: index.indexType

```js
indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      }
```

#### slot: index.location

```js
location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.vcf.gz.tbi',
        },
        type: 'fileLocation',
      }
```

#### slot: vcfGzLocation

```js
vcfGzLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.vcf.gz' },
      type: 'fileLocation',
    }
```
