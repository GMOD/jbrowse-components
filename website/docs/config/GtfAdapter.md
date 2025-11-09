---
id: gtfadapter
title: GtfAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/GtfAdapter.md)

## Docs

### GtfAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "GtfAdapter",
  "uri": "yourfile.gtf"
}
```

### GtfAdapter - Slots

#### slot: gtfLocation

```js
gtfLocation: {
      type: 'fileLocation',
      description: 'path to gtf file, also allows for gzipped gtf',
      defaultValue: {
        uri: '/path/to/my.gtf',
        locationType: 'UriLocation',
      },
    }
```

#### slot: aggregateField

```js
aggregateField: {
      type: 'string',
      description:
        'field used to aggregate multiple transcripts into a single parent gene feature',
      defaultValue: 'gene_name',
    }
```
