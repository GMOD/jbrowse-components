---
id: bedpeadapter
title: BedpeAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

## Docs

intended for SVs in a single assembly

### BedpeAdapter - Slots

#### slot: bedpeLocation

can be plaintext or gzipped, not indexed so loaded into memory on startup

```js
bedpeLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedpe.gz',
        locationType: 'UriLocation',
      },
    }
```

#### slot: columnNames

```js
columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    }
```
