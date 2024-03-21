---
id: chainadapter
title: ChainAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/ChainAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/ChainAdapter/configSchema.ts)

### ChainAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
      type: 'stringArray',
    }
```

#### slot: chainLocation

```js
chainLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/file.chain' },
      type: 'fileLocation',
    }
```

#### slot: queryAssembly

can be specified as alternative to assemblyNames

```js
queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
      type: 'string',
    }
```

#### slot: targetAssembly

can be specified as alternative to assemblyNames

```js
targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
      type: 'string',
    }
```
