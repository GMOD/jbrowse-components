---
id: indexedfastaadapter
title: IndexedFastaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/IndexedFastaAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/IndexedFastaAdapter.md)

## Docs

### IndexedFastaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.fa.fai:

```json
{
  "type": "IndexedFastaAdapter",
  "uri": "yourfile.fa"
}
```

### IndexedFastaAdapter - Slots

#### slot: fastaLocation

```js
fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    }
```

#### slot: faiLocation

```js
faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
    }
```

#### slot: metadataLocation

```js
metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    }
```
