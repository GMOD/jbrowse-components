---
id: bedpeadapter
title: BedpeAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/bed/src/BedpeAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedpeAdapter/configSchema.ts)

intended for SVs in a single assembly

### BedpeAdapter - Slots

#### slot: bedpeLocation

can be plaintext or gzipped, not indexed so loaded into memory on startup

```js
bedpeLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.bedpe.gz',
      },
      type: 'fileLocation',
    }
```

#### slot: columnNames

```js
columnNames: {
      defaultValue: [],
      description: 'List of column names',
      type: 'stringArray',
    }
```
