---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/data-management/src/ucsc-trackhub/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/ucsc-trackhub/configSchema.ts)

### UCSCTrackHubConnection - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description:
        'optional list of genomes to import from this track hub, if empty all genomes will be imported',
      type: 'stringArray',
    }
```

#### slot: hubTxtLocation

```js
hubTxtLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'http:
      },
      description: 'location of the hub file (usually called hub.txt)',
      type: 'fileLocation',
    }
```

### UCSCTrackHubConnection - Derives from

```js
baseConfiguration: baseConnectionConfig
```
