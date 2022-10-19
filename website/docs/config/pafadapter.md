---
id: pafadapter
title: PAFAdapter
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
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    }
```
#### slot: pafLocation
```js

    /**
     * !slot
     */
    pafLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.paf',
        locationType: 'UriLocation',
      },
    }
```
