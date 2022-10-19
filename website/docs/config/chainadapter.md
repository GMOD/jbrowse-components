---
id: chainadapter
title: ChainAdapter
toplevel: true
---

#### slot: assemblyNames
```js

    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
    }
```
#### slot: targetAssembly
```js

    /**
     * !slot
     * can be specified as alternative to assemblyNames
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    }
```
#### slot: queryAssembly
```js

    /**
     * !slot
     * can be specified as alternative to assemblyNames
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    }
```
#### slot: chainLocation
```js

    /**
     * !slot
     */
    chainLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
    }
```
