---
id: cytobandadapter
title: CytobandAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/data_adapters/CytobandAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/CytobandAdapter.md)

## Docs

### CytobandAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "CytobandAdapter",
  "uri": "yourfile.bed"
}
```

### CytobandAdapter - Slots

#### slot: cytobandLocation

```js
cytobandLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/cytoband.txt.gz',
      },
    }
```
