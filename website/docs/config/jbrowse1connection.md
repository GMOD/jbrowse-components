---
id: jbrowse1connection
title: JBrowse1Connection
toplevel: true
---

#### slot: dataDirLocation

```js
dataDirLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http:
        locationType: 'UriLocation',
      },
      description:
        'the location of the JBrowse 1 data directory, often something like http:
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      description:
        'name of the assembly the connection belongs to, should be a single entry',
      type: 'stringArray',
      defaultValue: [],
    }
```

#### derives from:

```js
baseConfiguration: baseConnectionConfig
```

#### slot: namesIndexLocation

```js
namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names', locationType: 'UriLocation' },
      description: 'the location of the JBrowse1 names index data directory',
    }
```

#### slot: tracks

```js
tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    }
```
