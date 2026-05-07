---
id: bedgraphadapter
title: BedGraphAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/bed/src/BedGraphAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BedGraphAdapter.md)

## Docs

### BedGraphAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BedGraphAdapter",
  "uri": "yourfile.bed"
}
```

### BedGraphAdapter - Slots

#### slot: bedGraphLocation

```js
bedGraphLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedgraph',
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
