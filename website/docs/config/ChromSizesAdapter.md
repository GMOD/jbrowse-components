---
id: chromsizesadapter
title: ChromSizesAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ChromSizesAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ChromSizesAdapter.md)

## Docs

### ChromSizesAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "ChromSizesAdapter",
  "uri": "yourfile.chrom.sizes"
}
```

### ChromSizesAdapter - Slots

#### slot: chromSizesLocation

```js
chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/species.chrom.sizes',
        locationType: 'UriLocation',
      },
    }
```
