---
id: hicadapter
title: HicAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HicAdapter.md)

## Docs

### HicAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "HicAdapter",
  "uri": "file.hic"
}
```

### HicAdapter - Slots

#### slot: hicLocation

```js
hicLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hic',
        locationType: 'UriLocation',
      },
    }
```

#### slot: resolutionMultiplier

```js
resolutionMultiplier: {
      type: 'number',
      defaultValue: 1,
      description: 'Initial resolution multiplier',
    }
```
