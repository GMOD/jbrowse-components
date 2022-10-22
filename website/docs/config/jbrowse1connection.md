---
id: jbrowse1connection
title: JBrowse1Connection
toplevel: true
---

### Slots

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

## Derives from

```js
baseConfiguration: baseConnectionConfig
```
