---
id: jbrowse1connection
title: JBrowse1Connection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/JBrowse1Connection.md)

## Docs

### JBrowse1Connection - Slots

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

### JBrowse1Connection - Derives from

```js
baseConfiguration: baseConnectionConfig
```
