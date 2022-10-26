---
id: gff3tabixadapter
title: Gff3TabixAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### Gff3TabixAdapter - Slots

#### slot: gffGzLocation

```js
gffGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff.gz', locationType: 'UriLocation' },
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

#### slot: index.indexType

```js
location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.gff.gz.tbi',
          locationType: 'UriLocation',
        },
      }
```

#### slot: dontRedispatch

the Gff3TabixAdapter has to "redispatch" if it fetches a region and
features it finds inside that region extend outside the region we requested.
you can disable this for certain feature types to avoid fetching e.g. the
entire chromosome

```js
dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region'],
    }
```
