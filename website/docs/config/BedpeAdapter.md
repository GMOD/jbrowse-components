---
id: bedpeadapter
title: BedpeAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedpeAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedpeAdapter.md)

## Docs

intended for SVs in a single assembly

### BedpeAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedpeAdapter",
  "uri": "yourfile.bedpe.gz"
}
```

### BedpeAdapter - Slots

#### slot: bedpeLocation

```js
bedpeLocation: {
      type: 'fileLocation',
      description:
        'can be plaintext or gzipped, not indexed so loaded into memory on startup',
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
