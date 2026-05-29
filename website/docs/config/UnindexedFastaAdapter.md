---
id: unindexedfastaadapter
title: UnindexedFastaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/UnindexedFastaAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/UnindexedFastaAdapter.md)

## Docs

### UnindexedFastaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "UnindexedFastaAdapter",
  "uri": "yourfile.fa"
}
```

### UnindexedFastaAdapter - Slots

#### slot: rewriteRefNames

```js
rewriteRefNames: {
      type: 'string',
      defaultValue: '',
      contextVariable: ['refName'],
    }
```

#### slot: fastaLocation

```js
fastaLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa',
        locationType: 'UriLocation',
      },
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
