---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/UCSCTrackHubConnection.md)

## Docs

### UCSCTrackHubConnection - Slots

#### slot: hubTxtLocation

```js
hubTxtLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'http:
        locationType: 'UriLocation',
      },
      description: 'location of the hub file (usually called hub.txt)',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'optional list of genomes to import from this track hub, if empty all genomes will be imported',
    }
```

### UCSCTrackHubConnection - Derives from

```js
baseConfiguration: baseConnectionConfig
```
