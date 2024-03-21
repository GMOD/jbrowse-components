---
id: pafadapter
title: PAFAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/PAFAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/PAFAdapter/configSchema.ts)

### PAFAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
      type: 'stringArray',
    }
```

#### slot: pafLocation

```js
pafLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/file.paf',
      },
      type: 'fileLocation',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
      type: 'string',
    }
```

#### slot: targetAssembly

```js
targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
      type: 'string',
    }
```
