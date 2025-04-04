---
id: gff3adapter
title: Gff3Adapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3Adapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/Gff3Adapter.md)

## Docs

### Gff3Adapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "Gff3Adapter",
  "uri": "yourfile.gff3"
}
```

### Gff3Adapter - Slots

#### slot: gffLocation

```js
gffLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gff',
        locationType: 'UriLocation',
      },
    }
```
