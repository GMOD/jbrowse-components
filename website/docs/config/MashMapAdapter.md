---
id: mashmapadapter
title: MashMapAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/MashMapAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MashMapAdapter/configSchema.ts)

### MashMapAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description:
        'Target is the first value in the array, query is the second',
      type: 'stringArray',
    }
```

#### slot: outLocation

```js
outLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/mashmap.out',
      },
      type: 'fileLocation',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
      type: 'string',
    }
```

#### slot: targetAssembly

```js
targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
      type: 'string',
    }
```
