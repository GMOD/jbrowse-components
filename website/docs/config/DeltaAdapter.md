---
id: deltaadapter
title: DeltaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/DeltaAdapter.md)

## Docs

### DeltaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "DeltaAdapter",
  "uri": "yourfile.delta.gz",
  "queryAssembly": "hg19",
  "targetAssembly": "hg38"
}
```

### DeltaAdapter - Slots

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

alternative to assembly names

```js
targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    }
```

#### slot: queryAssembly

alternative to assembly names

```js
queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```

#### slot: deltaLocation

```js
deltaLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.delta',
        locationType: 'UriLocation',
      },
    }
```
