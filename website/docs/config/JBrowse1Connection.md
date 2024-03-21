---
id: jbrowse1connection
title: JBrowse1Connection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts)

### JBrowse1Connection - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description:
        'name of the assembly the connection belongs to, should be a single entry',
      type: 'stringArray',
    }
```

#### slot: dataDirLocation

```js
dataDirLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'http:
      },
      description:
        'the location of the JBrowse 1 data directory, often something like http:
      type: 'fileLocation',
    }
```

### JBrowse1Connection - Derives from

```js
baseConfiguration: baseConnectionConfig
```
