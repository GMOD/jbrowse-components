---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/data-management/src/ucsc-trackhub/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/ucsc-trackhub/configSchema.ts)

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
