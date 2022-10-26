---
id: chainadapter
title: ChainAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### ChainAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
    }
```

#### slot: targetAssembly

can be specified as alternative to assemblyNames

```js
targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    }
```

#### slot: queryAssembly

can be specified as alternative to assemblyNames

```js
queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    }
```

#### slot: chainLocation

```js
chainLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
    }
```
