---
id: mashmapadapter
title: MashMapAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### MashMapAdapter - Slots

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

```js
targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the target assembly',
    }
```

#### slot: queryAssembly

```js
queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames array: the query assembly',
    }
```

#### slot: outLocation

```js
outLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mashmap.out',
        locationType: 'UriLocation',
      },
    }
```
