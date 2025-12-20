---
id: cramadapter
title: CramAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/CramAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/CramAdapter.md)

## Docs

used to configure CRAM adapter

### CramAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.cram.crai:

```json
{
  "type": "CramAdapter",
  "uri": "yourfile.cram"
}
```

### CramAdapter - Slots

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
    }
```

#### slot: cramLocation

```js
cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    }
```

#### slot: craiLocation

```js
craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    }
```
