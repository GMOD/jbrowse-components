---
id: deltaadapter
title: DeltaAdapter
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
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
    }
```
#### slot: targetAssembly
```js

    /**
     * !slot
     * alternative to assembly names
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    }
```
#### slot: queryAssembly
```js

    /**
     * !slot
     * alternative to assembly names
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```
#### slot: deltaLocation
```js

    /**
     * !slot
     */
    deltaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.delta', locationType: 'UriLocation' },
    }
```
