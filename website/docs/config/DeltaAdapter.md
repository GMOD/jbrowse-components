---
id: deltaadapter
title: DeltaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/DeltaAdapter/configSchema.ts)

### DeltaAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
      type: 'stringArray',
    }
```

#### slot: deltaLocation

```js
deltaLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/file.delta' },
      type: 'fileLocation',
    }
```

#### slot: queryAssembly

alternative to assembly names

```js
queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
      type: 'string',
    }
```

#### slot: targetAssembly

alternative to assembly names

```js
targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
      type: 'string',
    }
```
