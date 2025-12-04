---
id: jb2trackhubconnection
title: JB2TrackHubConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/JB2TrackHubConnection.md)

## Docs

### JB2TrackHubConnection - Slots

#### slot: configJsonLocation

```js
configJsonLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http:
        locationType: 'UriLocation',
      },
      description:
        'location of the jb2 config file (usually called config.json)',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional list of genomes to import from this config.json, if empty all genomes will be imported',
    }
```

### JB2TrackHubConnection - Derives from

```js
baseConfiguration: baseConnectionConfig
```
