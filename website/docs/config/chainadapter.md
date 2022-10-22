---
id: chainadapter
title: ChainAdapter
toplevel: true
---

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
