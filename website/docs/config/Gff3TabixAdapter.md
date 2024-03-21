---
id: gff3tabixadapter
title: Gff3TabixAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/gff3/src/Gff3TabixAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3TabixAdapter/configSchema.ts)

### Gff3TabixAdapter - Slots

#### slot: dontRedispatch

the Gff3TabixAdapter has to "redispatch" if it fetches a region and features it
finds inside that region extend outside the region we requested. you can disable
this for certain feature types to avoid fetching e.g. the entire chromosome

```js
dontRedispatch: {
      defaultValue: ['chromosome', 'region'],
      type: 'stringArray',
    }
```

#### slot: gffGzLocation

```js
gffGzLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.gff.gz' },
      type: 'fileLocation',
    }
```

#### slot: index.indexType

```js
indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      }
```

#### slot: index.indexType

```js
location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.gff.gz.tbi',
        },
        type: 'fileLocation',
      }
```
