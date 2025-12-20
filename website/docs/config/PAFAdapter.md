---
id: pafadapter
title: PAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PAFAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/PAFAdapter.md)

## Docs

### PAFAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "PAFAdapter",
  "uri": "file.paf.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

### PAFAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
    }
```

#### slot: targetAssembly

```js
targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```

#### slot: pafLocation

```js
pafLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.paf',
        locationType: 'UriLocation',
      },
    }
```
